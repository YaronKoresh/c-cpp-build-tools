const path = require("node:path");
const process = require("node:process");
const fs = require("node:fs");

let bad_words = [];

let forbidden_headers = [
    "^$",
    "^_STL_INTRIN_HEADER$",
];

const headers_redirection = { };

const langToExt = {
	"C/C++": [".h",".hpp",".c",".cc",".cpp",".inl",".idl",".xml",".acf",".dlg",".inc",".rh",".tcc",""]
};
const langs = Object.keys(langToExt);
const extsByLang = Object.values(langToExt);
let lang = null;

let outputFile = null;
let mainFile = null;
let includedFiles = [];
let content = "";
let workDir = null;
let searchZone = null;

let multiline_comment = false;

let debugger_vals = [];

let lastFile = null;
let _lastFile = [];

let externC = null;

let lines = {
	"include": {},
	"current": null,
	"next": null,
	"remove": 0,
};

let depth = {
	"include": 0,
	"if": 0,
	"if0": {
		"paren": 0,
		"curly": 0,
	}
};

let pause = {
	"paren": null,
	"curly": null,
	"if": null,
};

let last_ident = 0;

let comm = null;

const Bundle = function( inFile, outFile, comments, included ){

	console.log("Include: " + included);

	included = included.split(",");

	comm = !!+comments;

	mainFile = path.basename(inFile);
	if(!mainFile){
		throw new Error("The main file is null!");
	}

	outputFile = path.resolve(outFile).replaceAll("\\","/");

	dirPath = path.dirname( path.resolve(inFile).replaceAll("\\","/") );
	workDir = path.resolve(dirPath).replaceAll("\\","/");
	searchZone = [workDir,...included.map( i => path.resolve(i).replaceAll("\\","/") )]; 

	fs.writeFileSync(outputFile, "");

	lastFile = CutPath(mainFile);
	ProcessFile(mainFile);

	fs.appendFileSync(outputFile, content);

	c = fs.readFileSync( outputFile , {encoding:'utf8'} ).replaceAll(/(\n){2,}/g,"\n").trim();
	fs.writeFileSync(outputFile, c );
};

function SafeAppendToOutput(str = null, opcode = true){
	try {

		if( str === null ){
			str = Line();
		}

		let str_copied = str.trim();

		let idn = Ident("");
		str = idn+str.trim();
		let newStr = str.replace("\t#elif","#elif").replace("\t#else","#else");
		if( str !== newStr ){
			str = newStr;
			idn = idn.replace("\t","");
		}

		if( opcode && comm ){
			let src = idn+`// ${lastFile} [${ lines["include"][lastFile] ?? "None" }]`;
			str = src + "\n" + str;
		}

		if( debugger_vals.length > 0 && !str_copied.startsWith("//") && comm ){
			let dbg = idn+`// ${debugger_vals.slice(-1)[0].trim()}`;
			str = dbg + "\n" + str;
		}

		if( depth["curly"] < 0 ){
			str += "\n";
			while( depth["curly"] < 0 ){
				str += "}";
				depth["curly"]++;
			}
		} else if( depth["paren"] < 0 ){
			str += "\n";
			while( depth["paren"] < 0 ){
				str += ")";
				depth["paren"];
			}
		}

		str = "\n" + str;

	} catch(e) {
		fs.appendFileSync(outputFile, content);
		throw e;
	}

	try {
		let content2 = content + str;
		content = content2;

	} catch(e){

		fs.appendFileSync(outputFile, content);
		fs.appendFileSync(outputFile, str);

		content = "";
	}
}

function ProcessFile(file) {

	for( let i = 0 ; i < forbidden_headers.length ; i++ ){
		let frbd = forbidden_headers[i];
		let re = new RegExp(frbd);
		let fits = re.test( file );
		if( fits ){
			return false;
		}
	}

	let shortFilePath = file;

	file = CutPath(file);

	if(
		includedFiles.includes( file )
	){
		return false;
	}

	_lastFile.push( lastFile )

	lastFile = file;

	includedFiles.push(file);

	if( !lang ){

		let langIndex = null;

		for(let i = 0 ; i < extsByLang.length ; i++){

			if( extsByLang[i].includes( path.extname(file) ) ){
				langIndex = i;
				break;
			}
		}

		if( langIndex === null ){

			throw new Error("Unsupported language detected!");
		}

		lang = langs[langIndex];

		console.log( "\nLanguage: " + lang + "\n" );

		if( comm ){
			SafeAppendToOutput( `// Language: ` + lang, false);
		}

		if( lang === "C/C++" ){
			depth.include++;
			ProcessFile("winuser.h");
			depth.include--;
			depth.include++;
			ProcessFile("windows.h");
			depth.include--;
		}

	} else if( !langToExt[lang].includes(path.extname(file)) ){

		throw new Error(`Multiple languages detected!\nCannot include "${file}" as ${lang}`);
	}

	lines["include"][file] = 0

	if(comm){
		SafeAppendToOutput( `// Processing depth is ${depth.include}: ` + file, false);
	}

	if( (file.endsWith(".h") || file.endsWith(".c")) && (!externC) && depth.include === 1 ){
		externC = file;
		depth["if"+depth.if].curly += 1;
		SafeAppendToOutput('extern "C" { // Added');
	}

	if( lang == "C/C++" ){
		ImportToCppC(file);
	}

	if( (file.endsWith(".h") || file.endsWith(".c")) && externC && externC === file && depth.include === 1 ){
		SafeAppendToOutput('} // Added');
		depth["if"+depth.if].curly -= 1;
	}

	if(comm){
		SafeAppendToOutput( "// Processed: " + file, false);
	}

	lastFile = _lastFile.pop()

	return true;
}

function FixSearchZone(){

	for( let i = 0 ; i < searchZone.length ; i++ ){

		for( let j = 0 ; j < searchZone.length ; j++ ){

			if( i != j && searchZone[i].includes(searchZone[j]) ){
				searchZone[j] = "*";
			}
		}
	}

	searchZone = searchZone.filter( v => v != "*" );
}

function CutPath(dangerPath){

	FixSearchZone();

	for( let i = 0 ; i < searchZone.length ; i++ ){

		let left = searchZone[i];
		let right = dangerPath.replaceAll("\\","/").replaceAll("//","/");

		let leftSplited = left.split("/");

		while(leftSplited.length > 0 ){

			let testPath = [...leftSplited,right].join("/");

			if( fs.existsSync(testPath) && fs.lstatSync(testPath).isFile() ){

				searchZone = [path.dirname(testPath),...searchZone];

				FixSearchZone();

				return testPath;
			} else {
				leftSplited.pop();
			}
		}
	}

	if( depth.if === 0 ){
		throw new Error( dangerPath + " was not found! Caller: " + lastFile );
	} else {
		console.warn( dangerPath + " was not found! Caller: " + lastFile );
	}
	return lastFile;
}

function AutoDeps(...t){
	for( let i = 0 ; i < t.length ; i++ ){
		depth.include++;
		ProcessFile(t[i]);
		depth.include--;
	}
}

function Start(...t){
	for( let i = 0 ; i < t.length ; i++ ){
		if(
			NoStringLine().toLowerCase().startsWith(t[i].toLowerCase())
		){
			return true;
		}
	}
	return false;
}

function End(...t){
	for( let i = 0 ; i < t.length ; i++ ){
		if(
			NoStringLine().toLowerCase().endsWith(t[i].toLowerCase())
		){
			return true;
		}
	}
	return false;
}

function In(...t){
	for( let i = 0 ; i < t.length ; i++ ){
		if(
			NoStringLine().toLowerCase().includes(t[i].toLowerCase())
		){
			return true;
		}
	}
	return false;
}

function Is(t){
	return NoStringLine().toLowerCase() === t.toLowerCase();
}

function Into(t){
	lines.current = t.trim();
}

function Prep(t){
	lines.current = (t + Line()).trim();
}

function Apnd(t){
	lines.current = (Line() + t).trim();
}

function Line(){
	return lines.current.replace(/#([ \t]){1,}/g,"#");
}

function NoStringLine(){
	return Line().replace( /"[^"]*"|'[^']*'/g, '' );
}

function TimesChar(c, withStrings = false){
	let l = withStrings ? Line() : NoStringLine();
	return (l.length - l.replaceAll(c,"").length) / c.length;
}

function Order(a,b){
	let l = Line();
	let idx_1 = l.indexOf(a);
	let idx_2 = l.indexOf(b);
	if( [idx_1,idx_2].includes(-1) ){
		return null;
	} else {
		return idx_1 < idx_2;
	}
}

function Release(_type){
	pause[_type] = null;
}

function Lock(_type){
	if( _type === "if" ){
		pause[_type] = Math.min( pause[_type], depth[_type] );
	} else {
		pause[_type] = Math.min( pause[_type], depth["if"+depth.if][_type] );
	}
}

function IsLocked(_type=null){
	if( _type ){
		return ( pause[_type] !== null && pause[_type] < depth[_type] );
	}
	return (
		pause["paren"] !== null && pause["paren"] < depth["if"+depth.if].paren
	) || (
		pause["curly"] !== null && pause["curly"] < depth["if"+depth.if].curly
	) || (
		pause["if"] !== null && pause["if"] < depth["if"]
	);
}

function SyncIf(up=false){
	if(
		up ||
		!depth["if"+depth.if.toString()]
	){
		let previous_if_scope = depth["if"+(depth.if - 1).toString()];
		depth["if"+depth.if.toString()] = {
			"curly": previous_if_scope ? previous_if_scope.curly : 0,
			"paren": previous_if_scope ? previous_if_scope.paren : 0,
		} 
	}
}

function Ident(l){
	let ident_lvls = (
		depth.if+
		depth["if"+depth.if.toString()].paren+
		depth["if"+depth.if.toString()].curly
	);
	if( last_ident > ident_lvls ){
		last_ident = ident_lvls;
		l = "\t".repeat(ident_lvls) + l;
	} else if( last_ident < ident_lvls ){
		l = "\t".repeat(last_ident) + l;
		last_ident = ident_lvls;
	} else {
		l = "\t".repeat(ident_lvls) + l;
	}
	return l
}

function SplitCodeAndStrings(l){
	let parts = [];
	let codeParts = l.split( /"[^"]*"|'[^']*'/g );
	let stringParts = l.match( /"[^"]*"|'[^']*'/g );
	for(var i = 0; i < codeParts.length; i++){
		parts.push(codeParts[i]);
		if( stringParts && stringParts[i] ){
			parts.push(stringParts[i]);
		}
	}
	return parts;
}

function RemoveStrings(l){
	return l.replace( /"[^"]*"|'[^']*'/g, '' );
}

function RemoveComments(l,inMultiLineComment=false){

	let parts = SplitCodeAndStrings(l);
	let inSingleLineComment = false;

	for(var i = 0; i < parts.length; i++){

		if(inSingleLineComment){
			parts[i] = "";
			continue;
		}

		let isString = i % 2 === 1;

		if( inMultiLineComment && isString ){
			parts[i] = "";
			continue;
		}

		if( isString ){
			continue;
		}

		parts[i] = parts[i].replace( /\/\/\*+/g , "//" ).replace( /\/\*((?!\*\/).)*\*\//g , "" );

		if( inMultiLineComment && parts[i].split("*/").length > 1 ){
			parts[i] = parts[i].split("*/")[1];
			inMultiLineComment = false;
		}

		let wasMultiLineComment = inMultiLineComment;

		if( (!inMultiLineComment) && parts[i].split("/*").length > 1 ){
			parts[i] = parts[i].split("/*")[0];
			inMultiLineComment = true;
		}

		if( (!wasMultiLineComment) && parts[i].split("//").length > 1 ){
			parts[i] = parts[i].split("//")[0];
			inMultiLineComment = false;
			inSingleLineComment = true;
		}

		if( inMultiLineComment ){
			parts[i] = "";
		}
	}

	return [ parts.join(""), inMultiLineComment ];
}

function ReplaceAppend(){

	if( Is("") ){
		return;
	}

	let _tmp = RemoveComments(Line(),multiline_comment);

	Into( _tmp[0] );
	multiline_comment = _tmp[1];

	if( Is("") ){
		return;
	}

	let removed = IsLocked();
	let removed_force = false;

	if( !IsLocked("paren") ){
		Release("paren");
	}

	if( !IsLocked("curly") ){
		Release("curly");
	}

	if( !IsLocked("if") ){
		Release("if");
	}

	if( lines.remove > 0 ){
		lines.remove--;
	}

	if(Is( "entry_point()" )){
		return SafeAppendToOutput();
	}

	if(In(...bad_words)){
		removed = true;
	}

	let f1 = TimesChar("#if");
	let f2 = TimesChar("#endif");
	let p1 = TimesChar("(");
	let p2 = TimesChar(")");
	let c1 = TimesChar("{");
	let c2 = TimesChar("}");
	if(
		!(
			f1===0 && f2===0 &&
			p1===0 && p2===0 &&
			c1===0 && c2===0
		)
	){
		let f = f1 - f2;
		let p = p1 - p2;
		let c = c1 - c2;
		if(In(...bad_words)){
			if(f>0){
				Lock("if");
			}
			if(p>0){
				Lock("paren");
			}
			if(c>0){
				Lock("curly");
			}
		}
		let removed2 = IsLocked();
		if( !removed && removed2 ){
			removed = true;
		}

		depth.if += f;
		if( depth["if"] < 0 ){
			depth["if"] = 0;
			removed_force = true;
		} else {
			SyncIf( f>0 );
		}

		depth["if"+depth.if].paren += p;

		depth["if"+depth.if].curly += c;

		if(
			(!IsLocked()) && Is("#endif")
		){
			removed = false;
		}
	}

	if(
		Start("typedef", "__int64", "__int32", "__int16", "__int8") &&
		!Start("typedef unsigned") &&
		!Start("typedef signed __int")
	){
		Into(
			Line().replace("__int8","signed char").replace("__int16","signed short").replace("__int32","signed int").replace("__int64","signed long long")
		)
	}

	if(
		(
			!Start("#if","#endif")
		) && (
			(
				Is( "#define WINAPI_FAMILY_PARTITION(Partitions) (Partitions)" ) &&
				lastFile.toLowerCase().endsWith("winapifamily.h")
			) || removed || Is("") || IsLocked()
		) || removed_force
	){
		if(comm){
			SafeAppendToOutput("// Removed: " + Line());
		}
		return;
	}

	if( Start("#error") ){
		SafeAppendToOutput("// Removed: " + Line());
		return;
	}

	SafeAppendToOutput();
}

function ImportToCppC(file){
	let all = null;
	try {
		all = fs.readFileSync( file , {encoding:'utf8'} );
	} catch(e) {
		throw new Error(`"${file}" is not a file!`)
	}
	let all_lines = all.split("\n");
	for ( let i = 0 ; i < all_lines.length ; i++ ){
		if( typeof lines["include"][file] !== "number" ){
			lines["include"][file] = 0;
		}
		lines["include"][file]++;

		let line = all_lines[i].trim();
		if( all_lines[i+1] ){
			lines.next = all_lines[i+1].trim();
		} else {
			lines.next = "";
		}

		while( line.endsWith("\\") ){
			line = line.slice(0,line.length-1);
			line += " ";
			line += lines.next
			i++;
			lines["include"][file]++;
			if( all_lines[i+1] ){
				lines.next = all_lines[i+1].trim();
			} else {
				lines.next = "";
			}
		}

		lines.current = line;

		debugger_vals.push(`PAREN:${depth["if"+depth.if].paren}${IsLocked("paren") ? ":LOCKED:"+pause.paren : ""} CURLY:${depth["if"+depth.if].curly}${IsLocked("curly") ? ":LOCKED:"+pause.curly : ""} IF:${depth.if}${IsLocked("if") ? ":LOCKED:"+pause.if : ""}`);

		if( line.startsWith("#") ){
			line = line.replace("#","").trim();
			if( line.startsWith("include ") || line.startsWith("include<") ){
				let includedPath = line.replace("include","").trim().replaceAll( /[\"\'<>]/g , "" ).trim().replace(/\/(\/|\*).*$/,"").trim();

				if( lang === "C/C++" && headers_redirection[includedPath] ){
					includedPath = headers_redirection[includedPath];
				}

				depth.include++;
				let new_import = ProcessFile(includedPath);
				depth.include--;

				if( new_import && comm ){
					SafeAppendToOutput( `// Back to depth ${depth.include}: ` + file, false);
				}
			} else {
				ReplaceAppend();
			}
		} else {
			ReplaceAppend()
		}
	}
}

module.exports = Bundle