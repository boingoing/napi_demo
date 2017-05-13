# N-API demo
This project is a simple npm module http server which uses the N-API port of leveldown in order to test Node.js with N-API. 

**Cloning**<br/>
Clone the napi_demo project to run the app:

```
git clone https://github.com/boingoing/napi_demo.git
```

**Installing**<br/>
Install the app via standard npm method:

```
npm install
```

**Building**<br/>
The leveldown module we are using here is N-API-enabled but this module does not have a published binary so we will need to build it to run this demo app. Our recommendation is to build leveldown with node-gyp which you can install globally:

```
npm install node-gyp -g
```

Building leveldown itself:

```
cd [path_to_napi_demo]/node_modules/leveldown
node-gyp configure
node-gyp build
```

**Running**<br/>
If you are running a v8.x nightly build of Node.js with N-API as an experimental feature, you will need to add the `--napi-modules` command line argument in order to load the N-API version of leveldown.

```
node [--napi-modules] app.js [--port number] [--path leveldb_path] [--verbose] [--test]
```

**Using**<br/>
This module starts an http server on the localhost by default listening on port 1338.

```
Options:
  --port     Start an http server listening on this port [number] [default: 1338]
  --path     Path in which we will create a leveldb database
                                                    [string] [default: "./dbout"]
  --verbose  Enable verbose logging                    [boolean] [default: false]
  --test     Perform a simple test of the leveldown module (Does not start the
             http server)                              [boolean] [default: false]
  --help     Show help                                                  [boolean]
  --version  Show version number                                        [boolean]
```
