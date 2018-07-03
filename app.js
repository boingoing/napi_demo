var leveldown = require('leveldown');
var http = require('http');
var fs = require("fs");
var yargs = require("yargs");
require('es6-shim');

var argv = parseArgs(yargs);
const useLogFile = argv.log != '';
const logFileStream =  useLogFile ? fs.createWriteStream(argv.log, { flags: 'a' }) : undefined;

trace('Detected Node: ' + getNodeVersion());

if (argv.test) {
    simpleTest();
} else {
    createServer();
}

function createServer() {
    var server = http.createServer(createHomePage);
    server.listen(argv.port);
    trace(`Server running at http://127.0.0.1:${argv.port}`);
}

function createHomePage(request, response) {
    var rqUrl = request.url;

    trace('Request: ' + rqUrl);

    if(rqUrl === '/') {
        function databaseReadCallback(dbValues) {
            trace(`Found ${dbValues.length} entries.`);
            
            //build dynamic values for replacement in HTML Template
            var variableReplacementMap = new Map();
            variableReplacementMap.set('%NODE_VERSION_STRING%', getNodeVersion());
            variableReplacementMap.set('%DB_VALUES%', JSON.stringify(dbValues));
            
            //render HTML
            response.writeHead(200, { "Content-Type": "text/html", 'Cache-control': 'no-cache' });
            response.write(buildFinalHTML(variableReplacementMap));
            response.end();
        }

        trace('Fetching entries from leveldown database...');
        readFromDatabase(databaseReadCallback);
    }
    if(rqUrl === "/OnButtonClicked") {
        function successCallback() {
            trace('Successfully added entry.');
            
            response.setHeader('Cache-Control', 'no-cache');
            response.end();
        }

        var key = getTime();
        var value = getNodeVersion();
        trace(`Adding entry for "${key}" to leveldown database...`);
        addToDatabase(key, value, successCallback);
    }
    if(rqUrl === "/favicon.ico") {
        response.writeHead(404, { "Content-Type": "text/html", 'Cache-control': 'no-cache' });
        response.end();
    }
}

function buildFinalHTML(variableMap) {
    var htmlPageTemplate = fs.readFileSync(__dirname + "/page.html", 'utf8');

    variableMap.forEach(function (value, key) {
        //Bad values that are likely an error.
        //We don't want to abort but we should report them for later triage.
        if (value === undefined || value === NaN || value === Infinity) {
            trace(`Potentially bad value encountered in templating -- ${value} @ timestamp ${Date.now()}.`);
        }

        var allregex = new RegExp(key, 'g')
        htmlPageTemplate = htmlPageTemplate.replace(allregex, value);
    });
    return htmlPageTemplate;
}

function padUnder10(v) {
    return v < 10 ? '0' + v : v;
}

function getNodeVersion() {
    return process.versions.node + (process.jsEngine === "chakracore" ? ' (ChakraCore)' : '');
}

function getTime() {
    var date = new Date();
    var y = date.getFullYear();
    var mon = padUnder10(date.getMonth() + 1);
    var d = padUnder10(date.getDate());
    var h = padUnder10(date.getHours());
    var min = padUnder10(date.getMinutes());
    var s = padUnder10(date.getSeconds());
    return `${y}/${mon}/${d} ${h}:${min}:${s}`;
}

function getDatabase() {
    return leveldown(argv.path);
}

function readFromDatabase(callback) {
    var db = getDatabase();
    var dbValues = [];

    verboseTrace('leveldown#open...');
    db.open(function(err) {
        if(!err) {
            verboseTrace('leveldown#open succeeded');
            var count = 0;

            verboseTrace('leveldown#iterator...');
            var iterator = db.iterator({
                keyAsBuffer: false,
                valueAsBuffer: false,
                fillCache: true
            });
            verboseTrace('leveldown#iterator succeeded');

            function endCallback(err) {
                if (!err) {
                    verboseTrace(`iterator#end succeeded: Found ${count} entries.`);
                } else {
                    verboseTrace(`iterator#end failed: ${err}`);
                }
                verboseTrace('leveldown#close...');
                db.close(function(err){
                    if (!err) {
                        verboseTrace('leveldown#close succeeded');
                        callback(dbValues);
                    } else {
                        verboseTrace('leveldown#close failed: ' + err);
                    }
                });
            }

            function nextCallback(err, key, value) {
                if (!err) {
                    verboseTrace(`iterator#next succeeded: key="${key}" value="${value}"`);

                    if (err === undefined && key === undefined && value === undefined) {
                        verboseTrace('iterator#end...');
                        iterator.end(endCallback);
                    } else {
                        dbValues.push([key, value]);
                        count++;

                        verboseTrace('iterator#next...')
                        iterator.next(nextCallback);
                    }
                } else {
                    verboseTrace("iterator#next failed: " + err);
                }
            }

            verboseTrace("iterator#next...");
            iterator.next(nextCallback);
        } else {
            verboseTrace('leveldown#open failed: ' + err);
        }
    });
}

function addToDatabase(key, value, callback) {
    var db = getDatabase();
    
    verboseTrace('leveldown#open...');
    db.open(function(err) {
        if(!err) {
            verboseTrace('leveldown#open succeeded');
            verboseTrace('leveldown#put("' + key + '", "' + value + '")...');

            db.put(key, value, { sync: true }, function(err) {
                if(!err) {
                    verboseTrace('leveldown#put succeeded');
                } else {
                    verboseTrace('leveldown#put failed: ' + err);
                }

                verboseTrace('leveldown#close...');
                db.close(function(err) {
                    if (!err) {
                        verboseTrace('leveldown#close succeeded');
                        callback();
                    } else {
                        verboseTrace('leveldown#close failed: ' + err);
                    }
                });
            });
        } else {
            verboseTrace('leveldown#open failed: ' + err);
        }
    });
}

function trace(msg) {
    console.log(msg);
    if (useLogFile) {
        logFileStream.write(`${msg}\n`);
    }
}

function verboseTrace(msg) {
    if (argv.verbose) {
        trace(msg);
    }
}

function parseArgs(yargs) {
    var _argv = yargs
        .option('port', {
            default: 1338,
            type: 'number',
            describe: 'Start an http server listening on this port'
        })
        .option('path', {
            default: './dbout',
            type: 'string',
            describe: 'Path in which we will create a leveldb database'
        })
        .option('verbose', {
            default: false,
            type: 'boolean',
            describe: 'Enable verbose logging'
        })
        .option('test', {
            default: false,
            type: 'boolean',
            describe: 'Perform a simple test of the leveldown module (Does not start the http server)'
        })
        .option('log', {
            default: '',
            type: 'string',
            describe: 'Filename of an optional log'
        })
        .usage('Simple http server using leveldown to test Node.js with N-API.\nUsage: $0 --port [number] --path [database_path] --verbose --test --log [filename]')
        .help('help')
        .version()
        .argv;

    return _argv;
}

function simpleTest() {
    var time = getTime();
    function testAddCallback() {
        function testReadCallback(values) {
            if (values.find(v => { return v[0] === time; })) {
                trace('Test passed!');
            } else {
                trace('Test failed!');
            }
        }
        readFromDatabase(testReadCallback);
    }
    addToDatabase(time, getNodeVersion(), testAddCallback);
}
