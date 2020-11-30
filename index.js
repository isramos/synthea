const http = require("http");
const Props = require("properties");
const childProcess = require("child_process");
const fs = require("fs");
const Url = require("url");

const filePath = "/synthea/src/main/resources/synthea.properties";
let outputPath = "/synthea/output/fhir";

if (process.env.STUBDATA === "true") {
  console.log("Local development - using stubdata.");
  outputPath = "./stubdata";
}

function loadConfig() {
  return Props.parse(fs.readFileSync(filePath, "utf8"), { namespaces: false });
}

function saveConfig(data) {
  fs.writeFileSync(filePath, Props.stringify(data), "utf8");
}

const server = http.createServer((request, response) => {
  let url = Url.parse(request.url, true);

  console.log(`Request ${request.method} Url.pathname: `, url.pathname);

  if (request.method === "OPTIONS") {
    return sendResponse(response, null, 204);
  }

  if (url.pathname === "/") {
    const help = { help: { '/post': 'create patient', '/get': 'list patient files', '/get/sample file.json': 'get one patient file.'}}
    return sendResponse(response, help, 200);
  }

  let fsData = null;
  if (url.pathname === "/get") {
    console.log("Getting file names.");

    try{
      fsData = {}
      fsData.dir = fs.readdirSync(outputPath, "utf-8");
    } catch(err){
      fsData = {dir: []}
    }
    
  } else if (url.pathname.indexOf("/get/") > -1) {
    const fileName = decodeURI( url.pathname.slice("/get/".length) );
    console.log(`Getting file: ${fileName}`);
    try {
      fsData = JSON.parse( fs.readFileSync(outputPath + "/" + fileName, "utf-8"));
    } catch (err) {
      fsData = null
    }
  }

  if (fsData) {
    return sendResponse(response, fsData, 200)
  }

  if (url.pathname === "/delete") {
    fsData = fs.readdirSync(outputPath, "utf-8");
    fsData.forEach( file => {
      const fileWithPath = `${outputPath}/${file}`
      try {
        fs.unlinkSync(fileWithPath)
      } catch(err) {
        console.error(err)
      }
    })
    return sendResponse(response, {status: 'Delete complete.', files: fsData}, 200)
  }

  if (url.pathname != "/post") {
    return sendResponse(response, {status: 'Not Found'}, 404)
  }

  if (process.env.STUBDATA === "true") {
    const now = Date.now()
    if (!fs.existsSync(outputPath)){
      fs.mkdirSync(outputPath);
    }
    fs.writeFileSync(`${outputPath}/test_${now}.json`, JSON.stringify({ createdAt: now}), 'utf-8')
    return sendResponse(response, {status:'New file created.'}, 200)
  }

  let cfg = loadConfig();
  let query = url.query;
  let stu = query.stu == "2" ? 2 : 3;
  let num = parseInt(query.p || "1", 10);

  if (isNaN(num) || !isFinite(num) || num < 1) {
    const errStr = "Invalid p parameter"
    return sendResponse(response, {status:errStr}, 400)
  }

  if (num > 100000) {
    const errStr = "Invalid p parameter. We cannot generate more than 100000 patients"
    return sendResponse(response, {status:errStr}, 400)
  }

  cfg["exporter.ccda.export"] = false;
  cfg["exporter.fhir.use_shr_extensions"] = false;
  cfg["exporter.csv.export"] = false;
  cfg["exporter.text.export"] = false;
  cfg["exporter.cost_access_outcomes_report"] = false;
  cfg["exporter.prevalence_report"] = false;
  cfg["generate.append_numbers_to_person_names"] = false;
  cfg["exporter.fhir.export"] = stu == 3;
  cfg["exporter.fhir_dstu2.export"] = stu == 2;

  saveConfig(cfg);

  let proc = childProcess.execFile("/synthea/run_synthea", ["-p", num + ""], {
    cwd: "/synthea/",
    stdio: "inherit",
  });

  proc.stdout.pipe(response);
  proc.stderr.pipe(response);
});

server.listen({ host: "0.0.0.0", port: 80 }, () => {
  console.log(`Synthea server listening on %o`, server.address());
});


function sendResponse(response, data, statusCode = 200){

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": 2592000, // 30 days
    "Content-Type": "application/json"
  }

  response.writeHead(statusCode, headers);
  if(data){
    response.write(JSON.stringify(data));
  }
  
  return response.end();
}