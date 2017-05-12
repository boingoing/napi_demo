var leveldown = require('leveldown');
var http = require('http');
var fs = require("fs");
var yargs = require("yargs");
require('es6-shim');

var argv = parseArgs(yargs);

trace('Detected Node: ' + getNodeVersion());

if (argv.test) {
    simpleTest();
} else {
    createServer();
}

function createServer() {
    var server = http.createServer(createHomePage);
    server.listen(argv.port);
    trace('Server running at ' + argv.serverUrl);
}

function createHomePage(request, response) {
    var rqUrl = request.url;

    trace('Request: ' + rqUrl);

    if(rqUrl === '/') {
        function databaseReadCallback(dbValues) {
            //build dynamic values for replacement in HTML Template
            var variableReplacementMap = new Map();
            variableReplacementMap.set('%NODE_VERSION_STRING%', getNodeVersion());
            variableReplacementMap.set('%DB_VALUES%', JSON.stringify(dbValues));
            variableReplacementMap.set('%SERVER_URL%', argv.serverUrl);
            
            //render HTML
            response.writeHead(200, { "Content-Type": "text/html", 'Cache-control': 'no-cache' });
            response.write(buildFinalHTML(variableReplacementMap));
            response.end();
        }

        readFromDatabase(databaseReadCallback);
    }
    if(rqUrl === "/OnButtonClicked") {
        function successCallback() {
            response.setHeader('Cache-Control', 'no-cache');
            response.end();
        }

        addToDatabase(getTime(), getNodeVersion(), successCallback);
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
            var msg = 'Potentially bad value encountered in templating -- ' + value + ' @ timestamp ' + Date.now() + '.';
            trace(msg);
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

    trace('leveldown#open...');
    db.open(function(err) {
        if(!err) {
            trace('leveldown#open succeeded');
            var count = 0;

            trace('leveldown#iterator...');
            var iterator = db.iterator({
                keyAsBuffer: false,
                valueAsBuffer: false,
                fillCache: true
            });
            trace('leveldown#iterator succeeded');

            function endCallback(err) {
                if (!err) {
                    trace("iterator#end succeeded: Found " + count + " entries.");
                } else {
                    trace('iterator#end failed: ' + err);
                }
                db.close(function(err){
                    if (!err) {
                        trace('leveldown#close succeeded');
                        callback(dbValues);
                    } else {
                        trace('leveldown#close failed: ' + err);
                    }
                });
            }

            function nextCallback(err, key, value) {
                if (!err) {
                    verboseTrace('iterator#next succeeded');

                    if (err === undefined && key === undefined && value === undefined) {
                        trace('iterator#end...');
                        iterator.end(endCallback);
                    } else {
                        dbValues.push([key, value]);
                        count++;

                        verboseTrace('iterator#next...')
                        iterator.next(nextCallback);
                    }
                } else {
                    trace("iterator#next failed: " + err);
                }
            }

            trace("iterator#next...");
            iterator.next(nextCallback);
        } else {
            trace('leveldown#open failed: ' + err);
        }
    });
}

function addToDatabase(key, value, callback) {
    var db = getDatabase();
    
    trace('leveldown#open...');
    db.open(function(err) {
        if(!err) {
            trace('leveldown#open succeeded');
            trace('leveldown#put("' + key + '", "' + value + '")...');

            db.put(key, value, { sync: true }, function(err) {
                if(!err) {
                    trace('leveldown#put succeeded');
                } else {
                    trace('leveldown#put failed: ' + err);
                }

                trace('leveldown#close...');
                db.close(function(err) {
                    if (!err) {
                        trace('leveldown#close succeeded');
                        callback();
                    } else {
                        trace('leveldown#close failed: ' + err);
                    }
                });
            });
        } else {
            trace('leveldown#open failed: ' + err);
        }
    });
}

function trace(msg) {
    console.log(msg);
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
        .usage('Simple http server using leveldown to test Node.js with N-API.\nUsage: $0 --port [number] --path [database_path] --verbose --test')
        .help('help')
        .version()
        .argv;

    _argv.serverUrl = 'http://127.0.0.1:' + _argv.port;

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
