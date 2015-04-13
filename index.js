var fs = require('fs');
var winston = require('winston');
var winstonCloudWatch = require('winston-cloudwatch');

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({ json: false, timestamp: true, colorize: true, prettyPrint: true }),
  ],
  exceptionHandlers: [
    new (winston.transports.Console)({ json: false, timestamp: true, colorize: true, prettyPrint: true }),
  ],
  exitOnError: true
});

// remove compound colorization for file transport
var old_log = winston.transports.File.prototype.log;
winston.transports.File.prototype.log = function (level, msg, meta, callback) {
	msg = msg.replace(/\u001b\[\d{1,3}m/g, '');
	old_log.call(this, level, msg, meta, callback);
};

// add "write" method for compatibility with old compound logger
logger.write = function(str){
	this.info(str);
}

// init logger with compound
logger.init = function(compound){
	if( !compound || !compound.root || !compound.app || typeof compound.app.set !== 'function'){
		throw "'compound' object should be defined";
	}
	compound.logger = this;

	var logsDir = compound.root + '/log';
	var logFile = compound.app.set('env') + '.log'
    
    var fs = require('fs');

    var data = fs.readFileSync('./aws.json'),
      aws;
    
    try {
        aws = JSON.parse(data);
    }
    catch (err) {
        console.log('There has been an error parsing your aws.json config.')
        console.log(err);
    }
    
	var addTransport = function(){
            if (!fileTransportExists(logsDir, logFile)) {
                this.add(winston.transports.File, {
                    filename: logsDir + '/' + logFile,
                    handleExceptions: true,
                    prettyPrint: true,
                    json: false
                });
            }
            if (aws) {
                this.add(winstonCloudWatch, {
                    logGroupName: aws.logGroupName,
                    logStreamName: aws.logStreamName,
                    awsAccessKeyId: aws.accessKeyId,
                    awsSecretKey: aws.secretAccessKey,
                    awsRegion: aws.region
              });
            }
	}.bind(this);

    var fileTransportExists = function (logsDir, logFile) {
        return this.transports.file && (
            this.transports.file.dirname  === logsDir && 
            this.transports.file.filename === logFile
        );
    }.bind(this);
	
	try {
		if ( !fs.existsSync(logsDir) ){
			fs.mkdirSync( logsDir );
			addTransport();
		}
		else {
			var stats = fs.statSync( logsDir );
			if ( !stats.isDirectory() ){
				this.error('Cannot create log directory. File with the same name is already exists');
			}
			else {
				// Directory is already exists
				addTransport();
			}
		}
	}
	catch( err ){
		this.error('Cannot create log directory. ' + err);
	}
};

module.exports = logger;
