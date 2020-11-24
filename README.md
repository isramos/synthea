# synthea

Static build of Synthea with http interface

This project exists because we needed a static build of Synthea - one that will
not have to download anything when you run it for the first time and that will
have the java files pre-compiled. This way it can safely be used later, even
without internet connection. This makes it perfect for using in a Docker image.

Another feature is that we have simple HTTP server in front of it so instead of
having to edit config file, one can just visit

```
http://localhost/?stu=2&p=10
```

where `stu` can be `2` or `3` and `p` is the number of patients to generate.
Having such http frontend makes the image suitable for docker composed stacks.

## Installation

a. Just use the existing image **From Docker** (do not use this method, I have not yet published into docker)

```sh
docker run -d -p 8000:80 smartonfhir/synthea
```

b. Build it yourself **From Git**

```sh
git clone --recurse-submodules https://github.com/isramos/synthea.git
cd synthea
docker docker build -t my-synthea .
docker run -d -p 8000:80 my-synthea
```

## Usage

The purpose of this is to generate patients so to make use of it, you have to
mount an external folder where the generated data will go. Here is a quick
example that will generate 100 stu3 patients in `/my/local/patients/fhir`
(assuming that `/my/local/patients/` exists):

```sh
docker run -d -p 8000:80 -v /my/local/patients:/synthea/output smartonfhir/synthea
curl -Ns "http://localhost:8000/post?stu=3&p=100"
# or just open http://localhost:8000/post?stu=3&p=100 in your browser
```


### Usage - Web Service 

The purpose of the webservice mode is to GET the generated files over a REST call instead of accessing the output folder directly. This allow you to have a Syntea web service hosted in the Cloud and where multiple users can access it.

Here's the APIs:

- '/': Help
- '/post': Generate Patient(s) and put them in a server folder
- '/get':  Get list of generated patients
- '/get/{filename}: Retrieve one of the generated patients

### Development node:

If you need to change the node.js server code, here's a reminder how to build and run: 

Build: `docker build -t my-synthea .`
Run: `docker run -d -p 8000:80 my-synthea`
