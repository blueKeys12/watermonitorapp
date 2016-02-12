var express        = require('express.io');
var morgan         = require('morgan');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var ds18b20	   = require('ds18b20');
var app            = express();
var database = require('mysql');
var twilio = require('twilio');
var client = new twilio.RestClient('AC33b71bcabab96c78c7575e864b102b3e', '46e3dd7cc62a72f7d27f289c4dac1ee6');

//stuff for streaming
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');

var spawn = require('child_process').spawn;
var proc;

//connect to database
var connection = database.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'dtproject',
  database : 'sensorData'
});
connection.connect();
var temp = ds18b20.temperatureSync('28-000006c43b7f');
	app.set('tempFar', temp*1.8+32);
	var data = {Celsius: temp, Farenheit: app.get('tempFar'), pH: 7.0};
	connection.query('INSERT INTO monitor SET ?', data, function(err, result) {
		if(err){
			console.log('Error while performing insert.');
		} else {
			console.log(app.get('tempFar'));
		}
	});
	connection.query('SELECT AVG(Farenheit) FROM monitor WHERE monitor.Time > DATE_SUB(CURDATE(), INTERVAL 1 DAY)', function(err, rows){
		if(!err){
			console.log(rows);
			app.set('tempAvg', rows[0]['AVG(Farenheit)']);
			console.log(app.get('tempAvg'));
		}
		else {
			console.log("Error performing Select.");
		}
	});

app.http().io()
app.use(express.static(__dirname + '/public')); 	// set the static files location /public/img will be /img for users
app.use(morgan('dev')); 					// log every request to the console
app.use(bodyParser()); 						// pull information from html in POST
app.use(methodOverride()); 					// simulate DELETE and PUT
app.get('/getTemp', function(req, res) {
	res.json({temp: ds18b20.temperatureSync('28-000006c43b7f')});
});
app.get('/', function(req, res) {
	res.sendFile(__dirname + '/public/app/video/video.html');
});
app.set('limit', 80);

var sockets = {};

io.on('connection', function(socket){
	sockets[socket.id] = socket;
	socket.on('disconnect', function(){
		delete sockets[socket.id];
		if(Object.keys(sockets).length == 0) {
			app.set('watchingFile', false);
			if(proc) proc.kill();
			fs.unwatchFile('/stream/image_stream.jpg');
		}
	});
	socket.on('start-stream', function() {
		startStreaming(io);
	});
	socket.on('home', function() {
		sensorTracking(io);
	});
	socket.on('setLimit', function(data){
		app.set('limit', data.limit);
		app.set('phone', data.phone);
		console.log(app.get('limit'), app.get('phone'));
	});
});


function stopStreaming(){
	console.log("stop Streaming")
	if(Object.keys(sockets).length == 0){
		app.set('watchingFile', false);
		if(proc) proc.kill();
		fs.unwatchFile('/stream/image_stream.jpg');
	}
}

function startStreaming(io){
	if(app.get('watchingFile')){
		io.sockets.emit('liveStream', '/stream/image_stream.jpg?_t=' + (Math.random() * 100000));
		return;
	}
	
	var args = ["-w", "640", "-h", "360", "-q", "30", "-o", "./public/stream/image_stream.jpg", "-t", "999999999", "-tl", "35"];
		proc = spawn('raspistill', args);
		
	app.set('watchingFile', true);
		fs.watchFile('./public/stream/image_stream.jpg', {persistent: true, interval: 10}, function(current, previous){
			io.sockets.emit('liveStream', '/stream/image_stream.jpg?_t=' + (Math.random() * 100000));
		})
}

function sensorTracking(io){
	io.sockets.emit('tempData', {temp: app.get('tempFar'), avgTemp: app.get('tempAvg')});
}

http.listen(4567, function() {
	console.log('listening on *:4567');
});
app.listen(4567);
console.log('Simple static server listening on port 4567');


setInterval(function(){
	var temp = ds18b20.temperatureSync('28-000006c43b7f');
	app.set('tempFar', temp*1.8+32);
	if(app.get('tempFar') > app.get('limit')){
		if(app.get('sendText')){
		app.set('sendText', false);
		client.sms.messages.create({
    		to:'+' + app.get('phone'),
    		from:'+18437797495',
    		body:"Your aquarium's temperature is above "+app.get('limit')
			}, function(error, message) {
    		// The HTTP request to Twilio will run asynchronously. This callback
			// function will be called when a response is received from Twilio
			// The "error" variable will contain error information, if any.
			// If the request was successful, this value will be "falsy"
				if (!error) {
				// The second argument to the callback will contain the information
				// sent back by Twilio for the request. In this case, it is the
				// information about the text messsage you just sent:
				console.log('Message sent on:');
				console.log(message.dateCreated);
			} else {
					console.log('Oops! There was an error.', error);
				}
			});
		}

	}
	else {
		app.set('sendText', true);
	}
	var data = {Celsius: temp, Farenheit: app.get('tempFar'), pH: 7.0};
	connection.query('INSERT INTO monitor SET ?', data, function(err, result) {
		if(err){
			console.log('Error while performing insert.');
		}
	});
	connection.query('SELECT AVG(Farenheit) FROM monitor WHERE monitor.Time > DATE_SUB(CURDATE(), INTERVAL 1 DAY)', function(err, rows){
		if(!err){
			console.log(rows);
			app.set('tempAvg', rows[0]['AVG(Farenheit)']);
			console.log(app.get('tempAvg'));
		}
		else {
			console.log("Error performing Select.");
		}
	});
}, 15000);

