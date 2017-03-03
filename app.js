var leveldown = require('leveldown');
var http = require('http');
var fs = require("fs");
var leveldown = require('leveldown');
require('es6-shim');

var server = http.createServer(createHomePage);
server.listen(1338);

var _nodeVersion = process.versions.node;
if(process.jsEngine === "chakracore") {
    _nodeVersion += " (ChakraCore)";
}

console.log("Server running at http://127.0.0.1:1338/");
console.log("Detected Node: " + _nodeVersion);

function createHomePage(request, response) {
    var rqUrl = request.url;

    console.log('Request: ' + rqUrl);

    //Get the LevelDB instance 
    var _db = leveldown('./dbout');

    if(rqUrl === '/') {
        function databaseReadCallback(dbValues) {
            //build dynamic values for replacement in HTML Template
            var variableReplacementMap = new Map();
            variableReplacementMap.set('%NODE_VERSION_STRING%', GetNodeVersionString());
            variableReplacementMap.set('%DB_ENTRY_STRING%', GetEntryString(GetNow(), _nodeVersion));        
            variableReplacementMap.set('%DB_VALUES%', dbValues);
            
            //render HTML
            response.writeHead(200, { "Content-Type": "text/html", 'Cache-control': 'no-cache' });
            response.write(BuildFinalHTML(variableReplacementMap));
            response.end();
        }

        ReadFromDatabase(_db, databaseReadCallback);
    }
    if(rqUrl === "/OnButtonClicked") {
        function successCallback() {
            response.setHeader('Cache-Control', 'no-cache');
            response.end();
        }

        AddToDatabase(_db, GetNow(), _nodeVersion, successCallback);
    }
    if(rqUrl === "/favicon.ico") {
        response.writeHead(404, { "Content-Type": "text/html", 'Cache-control': 'no-cache' });
        response.end();
    }
}

function GetNow() {
    return new Date().toTimeString();
}

function GetEntryString(timestamp, version) {
    return "Entry added on: <id class='DBEntry'>" + timestamp + "</id> by Node version: <id class='DBEntry'>" + version +"</id><br>";
}

function GetNodeVersionString() {   
    return 'Demo running on Node Version: '+ _nodeVersion + "<br><br>" + "Current Time: " + GetNow(); 
}

function BuildFinalHTML(variableMap) {
    var htmlPageTemplate = fs.readFileSync(__dirname + "/page.html", 'utf8');

    variableMap.forEach(function (value, key) {
        //Bad values that are likely an error.
        //We don't want to abort but we should report them for later triage.
        if (value === undefined || value === NaN || value === Infinity) {
            var msg = 'Potentially bad value encountered in templating -- ' + value + ' @ timestamp ' + Date.now() + '.';
            console.log(msg);
        }

        var allregex = new RegExp(key, 'g')
        htmlPageTemplate = htmlPageTemplate.replace(allregex, value);
    });
    return htmlPageTemplate;
}

function ReadFromDatabase(_db, callback) {
    var dbValues = "<p class=\"DBHeader\">LevelDown DB entries</p> <br>";

    console.log('leveldown#open...');
    _db.open(function(err) {
        if(!err) {
            console.log('leveldown#open succeeded');
            var count = 0;

            console.log('leveldown#iterator...');
            var iterator = _db.iterator({
                keyAsBuffer: false,
                valueAsBuffer: false,
                fillCache: true
            });
            console.log('leveldown#iterator succeeded');

            function endCallback(err) {
                if (!err) {
                    console.log("iterator#end succeeded: Found " + count + " entries.");

                    callback(dbValues);
                } else {
                    console.log('iterator#end failed: ' + err);
                }
                _db.close(function(err){
                    if (!err) {
                        console.log('leveldown#close succeeded');
                    } else {
                        console.log('leveldown#close failed: ' + err);
                    }
                });
            }

            function nextCallback(err, key, value) {
                if (!err) {
                    //console.log('iterator#next succeeded');

                    if (err === undefined && key === undefined && value === undefined) {
                        console.log('iterator#end...');
                        iterator.end(endCallback);
                    } else {
                        dbValues += GetEntryString(key, value);
                        count++;

                        //console.log('iterator#next...')
                        iterator.next(nextCallback);
                    }
                } else {
                    console.log("iterator#next failed: " + err);
                }
            }

            console.log("iterator#next...");
            iterator.next(nextCallback);
        } else {
            console.log('leveldown#open failed: ' + err);
        }
    });
}

function AddToDatabase(_db, key, value, callback) {
    console.log('leveldown#open...');
    _db.open(function(err) {
        if(!err) {
            console.log('leveldown#open succeeded');
            console.log('leveldown#put("' + key + '", "' + value + '")...');

            _db.put(key, value, { sync: true }, function(err) {
                if(!err) {
                    console.log('leveldown#put succeeded');
                    callback();
                } else {
                    console.log('leveldown#put failed: ' + err);
                }

                console.log('leveldown#close...');
                _db.close(function(err) {
                    if (!err) {
                        console.log('leveldown#close succeeded')
                    } else {
                        console.log('leveldown#close failed: ' + err)
                    }
                });
            });
        } else {
            console.log('leveldown#open failed: ' + err);
        }
    });
}
