(function(){
  "use strict";

  var path = require( 'path' )
    , request = require( 'request' )
    , date = require( 'dateformat' )
    , fs = require( 'graceful-fs' )
    , fsExt = require( 'fs-extra' )
    , exec = require( 'sync-exec' )
    , apiPath = path.resolve( __dirname, '../config/api.json' )
    , apiList = require( apiPath )
    , apiTotalCount = 0;

  for( var g in apiList ){
    for( var a in apiList[ g ] )
      apiTotalCount++;
  }

  var server = { 
    clients: [], error: [], configMtime: null, 
    rmCronCheckInterval: 1000 * 60 * 60 * 6/* log delete cron */, apiListCheckInterval: 1000 * 10/* apiList check interval. */,
    apiCallInterval: []/* api call interval array */, 
    fileInterval: 5/* file log write interval */, logInterval: 60/* minutes */, logRmDay: 7/* auto file log delete */ 
  };

  var logs = { dayChartData: {} };
  var cliCmd = [ "nc -v" ];

  var monService = {
    route: function( conn, msg ){
      switch( msg.code.toLowerCase() ){
        case "list" :
          monService.connect( conn );
          monService.send( conn, { code: 'list', apiList: apiList, apiTotalCount: apiTotalCount });
        break;
        case "log" :
          monService.readLog( conn, msg.data.group, msg.data.apiKey );
        break;
        case "clicheck" :
          monService.cliCheck( msg.data.group, msg.data.apiKey, function( result ){
            conn.sendUTF( JSON.stringify({ code: 'clicheck', result: result }) );
          });
        break;
      }
    },

    reloadConfig: function(){
      fs.readFile( apiPath, function( err, data ){
        if( err ){
          monService.monError( e );
          return;
        }
          
        try{
          apiList = JSON.parse( data.toString() );

          var count = 0;

          for( var i in server.apiCallInterval ){
            clearInterval( server.apiCallInterval[ i ] );

            count++;

            if( count >= Object.keys( server.apiCallInterval ).length ){
              server.apiCallInterval = [];
              var groupCount = 0; 

              for( var g in apiList ){
                groupCount++;

                var apiCount = 0; 
                for( var a in apiList[ g ] ){
                  apiCount++;
                  apiTotalCount++;

                  if( groupCount >= Object.keys( apiList ).length && apiCount >= Object.keys( apiList[ g ] ).length ){
                    monService.allSend({ code: 'list', apiList: apiList, apiTotalCount: apiTotalCount });
                    break;
                  }
                }
              }

              monService.call();
            }
          }
        } catch( e ){
          monService.monError( e );
        }
      });
    },

    checkApiList: function(){
      setInterval(function(){
        fs.stat( apiPath, function( err, stats ){
          var lastTime = stats.mtime.getTime();

          if( server.configMtime === null ){
            server.configMtime = lastTime;
            return;
          }

          if( server.configMtime != lastTime ){
            server.configMtime = lastTime;
            monService.reloadConfig();
          }
        });
      }, server.apiListCheckInterval );
    },
    
    connect: function( conn ){
      server.clients.push( conn );
    },

    send: function( conn, data ){
      try{
        conn.sendUTF( JSON.stringify( data ) );
      } catch( e ) {
        monService.monError( e );
      }
    },

    allSend: function( data ){
      try{
        for( var c in server.clients ){
          if( server.clients[ c ] ){
            if( server.clients[ c ].connected )
              server.clients[ c ].sendUTF( JSON.stringify( data ) ); 

          } else {
            server.clients.splice( c, 1 );
          }
        }
      } catch( e ) {
        monService.monError( e );
      }
    },

    call: function(){
      for( var g in apiList ){
        for( var a in apiList[ g ] ){
          var api = apiList[ g ][ a ];

          (function( group, apiKey, api ){
            var id = group + '-' + apiKey
              , isReset = false;

            server.error[ id ] = 0;

            if( logs.dayChartData[ id ] === undefined )
              logs.dayChartData[ id ] = {};

            server.apiCallInterval[ id ] = setInterval(function(){
              var nowDate = new Date()
                , nowHours = nowDate.getHours()
                , sTime = nowDate.getTime()
                , spendLogKey = 'h' + nowHours;

              if( !isReset && (nowDate.getHours() == 0 && nowDate.getMinutes() <= 5) ){
                server.error[ id ] = 0;
                logs.dayChartData[ id ] = {};
                isReset = true;
              }

              if( nowDate.getHours() == 0 && nowDate.getMinutes() > 5 )
                isReset = false;

              request.get( api.url, { timeout: api.timeout }, function( err, res, result ){
                var eTime = new Date().getTime()
                  , spendTime = ( eTime - sTime ) / Math.floor( 1000 )
                  , statusCode = ( res ) ? res.statusCode : null
                  , jsonResult = null
                  , isNormal = true;

                if( result ){
                  try{
                    jsonResult = JSON.parse( result );
                  } catch( e ) {
                    jsonResult = { msg: 'json result parsing error. please confirm sysapi.' };
                  }
                }

                try{
                  if( jsonResult == null ) throw false; 
                  if( typeof jsonResult != 'object' ) throw false;
                  if( !jsonResult.hasOwnProperty( 'code' ) && !jsonResult.hasOwnProperty( 'Code' ) ) throw false;  
                  if( err != null || statusCode != 200 || ( jsonResult.code != 0 && jsonResult.Code != 0 ) ) throw false;
                } catch( e ){
                  isNormal = false;
                }
                
                var sendData = {
                  code: 'result',
                  group: group,
                  key: apiKey,
                  api: api,
                  apiTotalCount: apiTotalCount,
                  isNormal: isNormal, 
                  err: err,
                  res: res,
                  result: jsonResult,
                  now: date( nowDate, 'HH:MM:ss' ),
                  spendTime: spendTime
                },
                logData = {
                  isNormal: isNormal,
                  statusCode: statusCode,
                  err: err,
                  result: jsonResult,
                  res: res,
                  spendTime: spendTime
                },
                dayChartData = {
                  now: date( nowDate, 'HH:MM:ss' ),
                  isNormal: isNormal, 
                  statusCode: statusCode,
                  err: err,
                  result: jsonResult,
                  spendTime: spendTime
                };

                if( !isNormal ){
                  dayChartData.spendTime = 10;
                  server.error[ id ]++;

                  /* file log - 처음, 오류 5번 발생시마다 */
                  if( server.error[ id ] == 0 || server.error[ id ] % server.fileInterval == 0 ){
                    monService.cliCheck( group, apiKey, function( result ){
                      logData.cliResult = result;
                      monService.writeFileLog( group, apiKey, logData, 'error' );
                    });
                  }

                  /* 일별 차트 - 오류 발생시마다 */
                  monService.cliCheck( group, apiKey, function( result ){
                    dayChartData.cliResult = result;
                    logs.dayChartData[ id ][ dayChartData.now ] = dayChartData; 
                  });

                } else {
                  /* file log, 일별 차트 - 1시간 단위 */
                  if( logs.dayChartData[ id ][ spendLogKey ] === undefined ){
                    monService.cliCheck( group, apiKey, function( result ){
                      logData.cliResult = result;
                      monService.writeFileLog( group, apiKey, logData, 'info' );
                    });

                    monService.cliCheck( group, apiKey, function( result ){
                      dayChartData.cliResult = result;
                      logs.dayChartData[ id ][ spendLogKey ] = dayChartData; 
                    });
                  }
                }

                monService.allSend( sendData );
              });
            }, api.interval );
           
          })( g, a, api );
        }
      }
    },

    rmCron: function(){
      setInterval(function(){
        fs.stat( path.resolve( __dirname, '../logs' ), function( err, stats ){
          if( stats.atime !== undefined ){

            var lastTime = stats.mtime.getTime()
              , nowTime = new Date().getTime()
              , diffDay = Math.round((nowTime - lastTime) / (1000 * 60 * 60 * 24));

            if( diffDay > server.logRmDay ){
              exec( 'rm -rf ' + path.resolve( __dirname, '../logs/*' ) ); 
              console.log( '[info][' + date( new Date(), 'yyyymmdd' ) + '] delete.' );
            }
          }
        });
      }, server.rmCronCheckInterval );
    },
    
    monError: function( e ){
      var logFile = path.resolve( __dirname, '../logs/monitoring/' + date( new Date(), 'yyyymmdd' ) + '.log' )
        , log = '[error][' + date( new Date(), 'HH:MM:ss' ) + ']' + e + '\n';

      fsExt.ensureFile( logFile, function( err ){
        if( err ) return;

        fs.appendFile( logFile, log, {encoding: 'utf8', flag: 'a+'}, function( err ){});
      });
    },

    writeFileLog: function( group, apiKey, data, type ){
      var logFile = path.resolve( __dirname, '../logs/' + group + '/' + apiKey + '/' + date( new Date(), 'yyyymmdd' ) + '.log' );

      monService.cliCheck( group, apiKey, function( result ){
        data.cliResult = result;
        var log = '[' + type + '][' + date( new Date(), 'HH:MM:ss' ) + ']' + JSON.stringify( data ) + '\n';

        fsExt.ensureFile( logFile, function( err ){
          if( err ) monService.monError( err );

          fs.appendFile( logFile, log, {encoding: 'utf8', flag: 'a+'}, function( err ){
            if( err ) monService.monError( err );
          }); 
        });
      });
    },

    readLog: function( conn, group, apiKey ){
      conn.sendUTF( JSON.stringify({ code: 'log', logInterval: server.logInterval, log: logs.dayChartData[ group + '-' + apiKey ] }) );
    },

    cliCheck: function( group, apiKey, callback ){
      var apiInfo = apiList[ group ][ apiKey ]
        , result = [];

      for( var c in cliCmd ){
        var cmd = cliCmd[ c ] + ' ' + apiInfo.host;

        if( cliCmd[ c ].indexOf( 'nc -v' ) >= 0 ) 
          cmd = cliCmd[ c ] + ' ' + apiInfo.host + ' ' + apiInfo.port;

        var output = exec( cmd );

        result.push({ cmd: cmd, output: output });

        if( c == cliCmd.length -1 )
          callback( result );
      }
    }
  };

  module.exports = monService;
})();
