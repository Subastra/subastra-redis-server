var express = require('express');

var app = express();

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  return next();
});

var http = require('http').createServer(app);
var mysql = require('mysql');
var moment = require('moment');
var fs = require('fs');
var socketio = require('socket.io');
var io = socketio.listen(http,{origins:'*:*'});
var request = require('request');
var reflectionURL = "http://subastra-liderdesarrollo.c9.io/app/index.php";

var sockets = [];
io.on('connection', function(socket) {
	console.log("conected");
});

var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'subastrs_root',
  password : '18005021',
  database : 'subastrs_aplication'
});

connection.connect(function(err){
	if(!err) {
	    console.log("Database is connected ... \n\n");  
	} else {
	    console.log("Error connecting database ... \n\n");  
	}
});

app.get('/m', function(req, res) {
	var notifik = {
		message: "hola",
		action: "TEST"
	};	
	io.sockets.emit("test_socket", notifik);
});

app.get('/prueba', function(req, res) {
	console.log("hola");	
});

//CRON JOB QUE PROGRAMA LAS SUBASTAS AUTOMATICAMENTE
var CronJob = require('cron').CronJob;
new CronJob('* * * * * *', function() {
	var query = connection.query('SELECT * from subasta WHERE estado = 3',[],function(err, rows, fields) {
		var ahora = moment(new Date()).format("YYYY-MM-DD HH:mm");
		for(var i = 0; i < rows.length; i++){
			
			var current_subasta = rows[i];
				
			var fecha_inicio_subasta =  moment(rows[i].fecha_inicio_subasta).format("YYYY-MM-DD") +  " " + rows[i].hora_inicio_subasta;
			var secondsDiff = moment(ahora).diff(fecha_inicio_subasta, 'seconds');
			if(secondsDiff == 0){
				var id_s = rows[i].id;
				var query2 = connection.query('UPDATE subasta SET estado = 2 WHERE id = ' + id_s, [], function(err, result) {
					fs.appendFile('log.txt', "\n" + ahora + " >> " + "ACTUALIZO SUBASTA CON ID="+ id_s, encoding='utf8', function (err) {
						
						var subasta_n = new Object();
							subasta_n.id_subasta = current_subasta.id;
							
						var notificacion  = {
							 id: null,
							 titulo: "inicio la subasta",
							 contenido: "acaba de iniciar la subasta que creaste",
							 fecha: moment(new Date()).format("YYYY-MM-DD"),
							 hora: moment(new Date()).format("HH:mm"),
							 id_user: current_subasta.us_id,
							 visto: 0,
							 author: 0,
							 action: JSON.stringify(subasta_n)
						};
						
						var query = connection.query('INSERT INTO notificaciones SET ?', notificacion, function(err, result) {
							var notifik = {
								message: "hola",
								action: "TEST"
							};	
							io.sockets.emit("begin_subasta-user-" + current_subasta.us_id, notifik);
						});
						
					});
				});			
			}
		}
	});
}, null, true, 'America/Bogota');
//FIN CRON JOB QUE PROGRAMA LAS SUBASTAS AUTOMATICAMENTE

new CronJob('* * * * * *', function() {
	var ahora = moment(new Date()).format("YYYY-MM-DD HH:mm");
	
	var query = connection.query('SELECT * from subasta WHERE estado = 2',[],function(err, rows, fields) {
		for(var i = 0; i < rows.length; i++){	
			var current_subasta = rows[i];
			var id_s = rows[i].id;
			var fecha_fin_subasta =  moment(rows[i].fecha_fin_subasta).format("YYYY-MM-DD") +  " " + rows[i].hora_fin_subasta;
			var secondsDiff = moment(fecha_fin_subasta).diff(moment(ahora), 'seconds');
			if(secondsDiff<=0){
				console.log("acabo la subasta");
				var action = {
					status : "close",	
					id_subasta : id_s
				};
				var query2 = connection.query('UPDATE subasta SET estado = 1 WHERE id = ' + id_s, [], function(err, result) {
					io.sockets.emit("subasta-" + id_s, action);
				});
				
				request(reflectionURL + '/notification/end_subasta/' + id_s, function (error, response, body) {
				   if (!error && response.statusCode == 200) {
					   console.log(body);
				   }
				});
				
			}
		}
	});
}, null, true, 'America/Bogota');


http.listen(8081, function(){
  console.log('listening on *:8081');
});
