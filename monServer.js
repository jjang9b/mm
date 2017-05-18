var express = require( 'express' )
  , app = express()
  , webServer = require( 'websocket' ).server
  , http = require( 'http' )
  , router = require( './routes/main' )( app );

var monSvc = require( './service/monService' );
var config = {
  PORT: 60999,
  WEBPORT: 61999,
  CLIENTS: {} 
};
 
app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );
app.use( express.static( 'res' ) );
 
/* express web server */
app.listen( config.PORT, function( req ){
  console.log( '[ws] express server port is ' + config.PORT );
});

var wsHttpServer = http.createServer().listen( config.WEBPORT, function(){
  console.log( '[ws] ws server port is ' + config.WEBPORT );
});

/* ws server */
var wsServer = new webServer({
  httpServer: wsHttpServer,
  autoAcceptConnections: false  
});

monSvc.call();
monSvc.checkApiList();
monSvc.rmCron();

wsServer.on( 'request', function( req ){
  var conn = req.accept();

  conn.on( 'message', function( msg ){
    monSvc.route( conn, JSON.parse( msg.utf8Data ) );

    console.log( '[ws] msg', msg );     
  });

  conn.on( 'close', function( reason, desc ){

    console.log( '[ws] ws client close.' + reason );
    console.log( desc );
  });
});
