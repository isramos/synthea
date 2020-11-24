const http = require("http");
const Props = require("properties");
const childProcess = require("child_process");
const fs = require("fs");
const Url = require("url");

const filePath = "/synthea/src/main/resources/synthea.properties";
let outputPath = "/synthea/output/fhir";

if (process.env.STUBDATA === "true") {
  console.log("Local development - using stubdata.");
  outputPath = "./";
}

function loadConfig() {
  return Props.parse(fs.readFileSync(filePath, "utf8"), { namespaces: false });
}

function saveConfig(data) {
  fs.writeFileSync(filePath, Props.stringify(data), "utf8");
}

const server = http.createServer((request, response) => {
  let url = Url.parse(request.url, true);

  console.log("Request Url: ", url.pathname);

  if (url.pathname === "/") {
    response.writeHead(200);
    return response.end(
      "Help: /post: create patient, /get: list patient files, /get/{filename}.json: get one patient file."
    );
  }

  let data = null;
  if (url.pathname === "/get") {
    console.log("Getting file names.");
    try{
      data = JSON.stringify(fs.readdirSync(outputPath, "utf-8"));
    } catch(err){
      data = '[]'
    }
    
  } else if (url.pathname.indexOf("/get/") > -1) {
    const fileName = decodeURI( url.pathname.slice("/get/".length) );
    console.log(`Getting file: ${fileName}`);
    try {
      data = fs.readFileSync(outputPath + "/" + fileName, "utf-8");
    } catch (err) {}
  }

  if (data) {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write(data);
    return response.end();
  }

  if (url.pathname != "/post") {
    response.writeHead(404);
    return response.end("Not Found");
  }

  if (process.env.STUBDATA === "true") {
    return response.end(
      "Feature not available in local development mode. You must run the docker container"
    );
  }

  let cfg = loadConfig();
  let query = url.query;
  let stu = query.stu == "2" ? 2 : 3;
  let num = parseInt(query.p || "1", 10);

  if (isNaN(num) || !isFinite(num) || num < 1) {
    response.writeHead(400);
    return response.end("Invalid p parameter");
  }

  if (num > 100000) {
    response.writeHead(400);
    return response.end(
      "Invalid p parameter. We cannot generate more than 100000 patients"
    );
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
