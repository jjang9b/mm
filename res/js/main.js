(function(){
  "use strict";

  var config = {
    wsUrl: 'ws://' + document.domain + ':31999',
    mScroll: { theme: 'rounded-dots-dark', autoHideScrollbar: true, scrollInertia: 1 },
    errorValue: 5,
    defaultColor: '#e1e1e1',
    successColor: '#469840',
    errorColor: 'red'
  };

  window.svcmon = { 
    'ws': null,
    'apiList': null,
    'boxCount': 0,
    'isDebug': false,
    'isSpeech': true,
    'errorCount': 0
  };

  var body = $( 'body' ) 
    , nav = $( 'nav' )
    , divTopRight = $( '#d_top_left' )
    , divStatus = divTopRight.find( '.status' )
    , divNow = divTopRight.find( '.now' )
    , divWrap = $( '#d_wrap' )
    , divConfig = $( '#d_config' )
    , divBoxGroup = $( '#d_box_group' ).show().clone()
    , divBox = $( '#d_box' ).show().clone()
    , divDetails = $( '#d_details' )
    , divResultConts = $( '#d_result_conts' )
    , divResult = $( '#d_result' )
    , divHeader = $( '#d_header' )
    , divNetwork = $( '#d_network' )
    , divHq = $( '#d_hq' )
    , divChart = $( '#d_chart' )
    , divLog = $( '#d_log' )
    , codeResult = $( '#c_result' )
    , codeHeader = $( '#c_header' )
    , codeNetwork = $( '#c_network' )
    , codeHq = $( '#c_hq' )
    , codeLog = $( '#c_log' )
    , btnDesc = $( '#btn_desc' )
    , btnConn = $( '#btn_conn' )
    , btnConsole = $( '#btn_console' )
    , btnSpeech = $( '#btn_speech' )
    , btnDescClose = $( '#btn_desc_close' )
    , btnDetailsClose = $( '#btn_details_close' )
    , btnLogRefresh = $( '#btn_log_refresh' )
    , btnNetworkCheck = $( '#btn_network_check' )
    , btnHqCheck = $( '#btn_hq_check' )
    , spanLogInterval = $( '#s_log_interval' )
    , footer = $( 'footer' );

  var func = {
    /* 1. websocket 접속. */
    wsConnect: function(){
      if( window.svcmon[ 'ws' ] !== null )
        return false;

      var ws = new WebSocket( config.wsUrl );

      window.svcmon[ 'ws' ] = ws;

      ws.onopen = function(){
        console.info( 'ws server open.' );
        divStatus.text( config.wsUrl + ' open' );

        func.sendMsg({ code: 'list' });
      };

      ws.onmessage = function( evt ){
        func.routes( evt );
      };

      ws.onclose = function(){
        window.svcmon[ 'ws' ] = null;
        divStatus.text( config.wsUrl + ' close' );

        console.info( 'ws server close, reconnect.' );
      };
    },

    /* 2. websocket 연결 확인. */
    checkWs: function(){
      if( window.svcmon[ 'ws' ] === null || window.svcmon[ 'ws' ].readyState != 1 ){
        alert( 'ws 연결을 확인해 주세요' );
        return false; 
      }

      return true;
    },

    /* 3. websocket 메세지 전송. */
    sendMsg: function( msg ){
      try{
        window.svcmon[ 'ws' ].send( JSON.stringify( msg ) );
      } catch( e ) {
        console.info( e );
      }
    },

    /* 4. 분기 처리. */
    routes: function( evt ){
      var ret = null; 

      try{
        if( evt )
          ret = JSON.parse( evt.data );

        switch( ret.code ){
          case "list" :
            divWrap.empty();

            window.svcmon.apiList = ret.apiList;

            for( var g in ret.apiList ){
              var group = ret.apiList[ g ]
                , apiBoxGroup = $( '#d_box_group_' + g )
                , btnConfig = null;

              if( apiBoxGroup.length <= 0 ){
                apiBoxGroup = divBoxGroup.clone(); 
                apiBoxGroup.attr( 'id', 'd_box_group_' + g );
                apiBoxGroup.append( $( '<div/>' ).attr( 'class', 'group_div' ).html( '<span class="group_name">' + g + '</span>' ) );
                apiBoxGroup.append( $( '<div/>' ).attr( 'class', 'clear_both' ) );

                divWrap.append( apiBoxGroup );
              }

              apiBoxGroup.find( '#d_box' ).remove();

              (function( g, group ){
                btnConfig = divBox
                  .clone()
                  .addClass( 'btn_config' )
                  .html( '<small><b>설정 정보</b></small>' )
                  .click(function( e ){
                    e.stopPropagation();

                    var oThis = $( this )
                      , codeConfig = divConfig.find( '.conts > pre > code' );

                    codeConfig.empty();
                    codeConfig.append( '<b class="text_brown"><small>' + g + ' 설정 정보</small></b><br /><br />' );
                    codeConfig.append( JSON.stringify( group, null, 4 ) );

                    hljs.highlightBlock( document.getElementById( 'd_config' ) );

                    divConfig.mCustomScrollbar( config.mScroll );
                    divConfig.show();

                    $( '#btn_config_close' ).click(function(){ divConfig.hide(); });
                    $( 'html' ).click(function( e ){
                      if( $( e.target ).parents( '#d_config' ).length > 0 ) return;
                      divConfig.hide();
                    });
                  });

                apiBoxGroup.append( btnConfig );
              })( g, group );

              for( var a in group ){ 
                var apiBox = apiBoxGroup.find( '#d_box_' + a )
                  , newBox;

                if( apiBox.length <= 0 ){
                  newBox = divBox.clone(); 
                  newBox.attr( 'id', 'd_box_' + a );

                  apiBoxGroup.append( newBox );
                  window.svcmon[ 'boxCount' ]++;
                }
              }
            }

            break;
          case "result" :
            divNow.text( ret.now );
            func.makeUi( ret );
          break;
          case "log" :
            func.logView( ret );
          break;
          case "clicheck" :
            func.networkView( ret );
          break;
        }
      } catch( e ) {

        console.error( e ); 
      }

      if( window.svcmon.isDebug )
        console.info( ret );
    },

    /* 5. UI 구성. */
    makeUi: function( ret ){
      var apiBoxGroup = $( '#d_box_group_' + ret.group )
        , apiBox = apiBoxGroup.find( '#d_box_' + ret.key );

      apiBox.find( '.box_left > .title > span' ).text( ret.key );
      apiBox.find( 'span[class=spend]' ).text( ret.spendTime + ' sec' );
      apiBox.attr( 'class', 'box success' );

      if( $( 'article' ).find( '.error' ).length <= 0 ){
        window.speechSynthesis.cancel();
        body.attr( 'class', '' );
      }

      if( !ret.isNormal ){
        apiBox.attr( 'class', 'box error' );
        body.attr( 'class', 'back_error' );

        if( window.svcmon.isSpeech ){
          if( window.svcmon.errorCount % 5 == 0 ){
            var msg = new SpeechSynthesisUtterance( ret.group + ' ' + ret.key + '서비스에서 오류가 발생하고 있습니다.' );
            msg.volumn = 3;
            msg.rate = 1;
            msg.lang = 'ko-KR';

            window.speechSynthesis.speak( msg );
            window.svcmon.errorCount = 0;
          }

          window.svcmon.errorCount++;
        }
      }

      if( divDetails.data( 'key' ) == ret.group + '_' + ret.key || divDetails.data( 'key' ) === undefined ){
        var dError = divResultConts.find( '#d_error' )
          , viewJson = '';

        dError.hide().find( 'p' ).empty();

        if( ret.err )
          dError.show().find( 'p' ).text( ret.err.code );

        if( !ret.isNormal ){
          divDetails.find( '.conts' ).css( 'border-top', '1.5em solid ' + config.errorColor );
          divResult.css( 'border-top', '3px solid ' + config.errorColor );

        } else {
          divDetails.find( '.conts' ).css( 'border-top', '1.5em solid ' + config.successColor );
          divResult.css( 'border-top', '3px solid ' + config.successColor );
        }

        if( ret.res != '' )
          divHeader.css( 'border-top', '3px solid ' + config.successColor );
        else
          divHeader.css( 'border-top', '3px solid ' + config.errorColor );

        for( var a in ret ){
          switch( a ){
            case "result":
              try{
                viewJson += a + ':\n' + JSON.stringify( ret[ a ], null, 4 ) + '\n';
              } catch( err ) {
                viewJson += a + ': ' + ret[ a ] + '\n'; 
              }
              continue;
              break;

            case "api":
              viewJson += a + ':\n' + JSON.stringify( ret[ a ], null, 4 ) + '\n';
              continue;
              break;

            case "spendTime":
              viewJson += a + ': ' + ret[ a ] + ' sec\n'; 
              continue;
              break; 

            case "code":
            case "group":
            case "apiTotalCount":
            case "key":
            case "err":
            case "isNormal":
              continue;
              break;

            case "res":
              viewJson += 'statusCode: ' + ret[ a ].statusCode + '\n';
              break;

            default:
              viewJson += a + ': ' + ret[ a ] + '\n'; 
              break;
          }
        };

        divDetails.data( 'key', ret.group + '_' + ret.key );
        btnLogRefresh.data({ 'group': ret.group, 'apikey': ret.key });
        btnNetworkCheck.data({ 'group': ret.group, 'apikey': ret.key });
        btnHqCheck.data( 'url', ret.api.url );

        divResultConts.find( '#s_title' ).text( '[' + ret.group + '] ' + ret.key );
        divResult.find( 'pre > code' ).text( viewJson );
        divResult.mCustomScrollbar( config.mScroll );

        if( ret.res ){
          divHeader.find( 'pre > code' ).text( JSON.stringify( ret.res.headers, null, 4 ) );
          divHeader.mCustomScrollbar( config.mScroll );
        }

        hljs.highlightBlock( document.getElementById( 'c_result' ) );
        hljs.highlightBlock( document.getElementById( 'c_header' ) );
      }

      apiBox.off( 'click' ).click(function(){
        if( !func.checkWs() ) return;

        nav.hide();
        divWrap.hide();
        
        if( ret.key.toLowerCase() != 'lb' ){
          divNetwork.hide(); 
          divHq.hide(); 
        }
        else{
          divNetwork.show();
          divHq.show(); 
        }

        divResultConts.find( '#s_title' ).empty();
        codeResult.empty();
        codeHeader.empty();
        codeNetwork.empty();
        codeHq.empty();
        divResult.css( 'border-top', '1px solid ' + config.defaultColor );
        divHeader.css( 'border-top', '1px solid ' + config.defaultColor );
        divHq.css( 'border-top', '1px solid  ' + config.defaultColor );
        divNetwork.css( 'border-top', '1px solid ' + config.defaultColor );

        func.sendMsg({ code: 'log', data: { group: ret.group, apiKey: ret.key } });

        divDetails.find( '.conts' ).css( 'border-top', '1.5em solid ' + apiBox.css( 'border-color' ) );
        divDetails.data( 'key', ret.group + '_' + ret.key ).show();
      });

      if( window.svcmon[ 'boxCount' ] >= ret.apiTotalCount )
        func.masonry();
    },

    /* 6. click 액션 정의. */
    click: function(){
      body.keydown(function( e ){
        if( e.keyCode == 27 ){
          window.speechSynthesis.cancel();
          window.svcmon.isDebug = false;
          window.svcmon.isSpeech = false;
          btnConsole.attr( 'class', 'btn btn_off' );
          btnSpeech.attr( 'class', 'btn btn_off' );
        }
      });

      btnDesc.click(function(){ 
        $( '.desc' ).show();
        divWrap.css( 'z-index', -1 ).hide();
      });

      btnConn.click(function(){ 
        if( window.svcmon[ 'ws' ] !== null ){
          $( this ).attr( 'class', 'btn btn_off' ).text( '종료' );
          window.svcmon[ 'ws' ].close();

        } else {
          $( this ).attr( 'class', 'btn btn_white' ).text( '연결' );
          func.wsConnect();
        }
      });

      btnConsole.click(function(){
        window.svcmon.isDebug = !window.svcmon.isDebug;

        if( window.svcmon.isDebug )
          $( this ).attr( 'class', 'btn btn_white' );
        else
          $( this ).attr( 'class', 'btn btn_off' );
      });

      btnSpeech.click(function(){
        window.svcmon.isSpeech = !window.svcmon.isSpeech;

        if( window.svcmon.isSpeech )
          $( this ).attr( 'class', 'btn btn_white' );
        else{
          window.speechSynthesis.cancel();
          $( this ).attr( 'class', 'btn btn_off' );
        }
      });

      btnDescClose.click(function(){
        $( '.desc' ).hide();
        divWrap.css( 'z-index', 1 ).show();
        divDetails.css( 'z-index', 1 );
      });

      btnDetailsClose.click(function(){
        divDetails.hide();
        codeLog.empty();
        divWrap.show();
        nav.show();
      });

      btnLogRefresh.click(function(){
        if( !func.checkWs() ) return;

        var oThis = $( this );
        func.sendMsg({ code: 'log', data: { group: oThis.data( 'group' ), apiKey: oThis.data( 'apikey' ) } });
      });

      btnNetworkCheck.click(function(){
        var oThis = $( this )
          , group = oThis.data( 'group' )
          , apiKey = oThis.data( 'apikey' );

        if( codeResult.html() == '' ){
          alert( '체크 결과를 받아온 이후 가능 합니다.' );
          return;
        }

        if( !func.checkWs() ) return;

        func.sendMsg({ code: 'clicheck', data: { group: group, apiKey: apiKey } });
      });

      btnHqCheck.click(function(){
        var url = $( this ).data( 'url' );

        if( codeResult.html() == '' ){
          alert( '체크 결과를 받아온 이후 가능 합니다.' );
          return;
        } 

        $.get( url, function( ret ){
          func.hqView( url, ret );
        }, 'json' ).fail( function( e, x, r ){
          func.hqView( url, r );
        });
      });
    },

    /* 7. 일별 차트 로그 노출. */
    logView: function( ret ){
      var count = 0;
      codeLog.empty();

      if( ret.log === undefined ){
        codeLog.html( '<small>일별 차트 로그 없음.</small>' );
        return;
      }

      ret.log = _.sortBy( ret.log, 'now' );

      footer.css( 'bottom', '0em' );

      func.chartist( ret );
      spanLogInterval.text( ret.logInterval );

      for( var l in ret.log ){
        if( ret.log[ l ] !== null ){
          var data = $.extend( true, {}, ret.log[ l ] );
          delete data.now;

          var viewData = JSON.stringify( data );
          viewData = viewData.replace( /\\n/g, "" ).replace( /\\/g, "" );

          if( ret.log[ l ].isNormal ){
            codeLog.append( '<small><b>[' + ret.log[ l ].now + ']</b></small>&nbsp;' );
            codeLog.append( viewData + '<br /><br />' );
          } else {
            codeLog.append( '<small><b class="text_error">[' + ret.log[ l ].now + ']</b></small>&nbsp;' );
            codeLog.append( '<span class="text_error">' + viewData  + '</span><br /><br />' );
          }
        }

        if( count == Object.keys( ret.log ).length -1 ){
          divLog.scrollTop( divLog.prop( 'scrollHeight' ) );
          divLog.mCustomScrollbar( config.mScroll );
        }

        count++;
      }

    },

    /* 8. 네트워크 체크 결과 노출. */
    networkView: function( ret ){
      var code = divNetwork.find( 'pre > code' );
      code.empty();

      divNetwork.css( 'border-top', '3px solid ' + config.successColor );

      for( var r in ret.result ){
        if( ret.result[ r ].stderr != null )
          divNetwork.css( 'border-top', '3px solid ' + config.errorColor );

        code.append( '<b>' + ret.result[ r ].cmd + '</b><br />' );
        code.append( '<small>에러 : ' + ret.result[ r ].output.stderr+ '</small><br />' );
        code.append( '<small>결과 : <br />' + ret.result[ r ].output.stdout + '</small><br />' );
        code.append( '<br />' );

        if( r == ret.result.length -1 )
          divNetwork.mCustomScrollbar( config.mScroll );
      }
    },

    /* 8-2. HQ 클라이언트 체크 결과 노출. */
    hqView: function( url, ret ){
      var code = divHq.find( 'pre > code' );
      code.empty();

      divHq.css( 'border-top', '3px solid ' + config.errorColor );

      if( ret.hasOwnProperty( 'code' ) || ret.hasOwnProperty( 'Code' ) ){
        if( ret.code == 0 || ret.Code == 0 )
          divHq.css( 'border-top', '3px solid ' + config.successColor );
      }

      code.html( '<b class="text_yellow">' + url + '</b><br />' );
      code.append( JSON.stringify( ret, null, 4 ) );
      hljs.highlightBlock( document.getElementById( 'c_hq' ) );
      divHq.mCustomScrollbar( config.mScroll );
    },

    /* 9. masonry UI. */
    masonry: function(){
      new Masonry( '#d_wrap', {
        itemSelector: '.box_group'
      });

      window.svcmon[ 'boxCount' ] = 0;
    },

    /* 10. 일별 차트 chartist library. */
    chartist: function( ret ){
      var label = []
        , data = []
        , c = 0;

      divChart.empty();

      for( var l in ret.log ){
        label.push( ret.log[ l ].now.split( ':' )[ 0 ] );
        data.push( ret.log[ l ].spendTime );

        if( c == Object.keys( ret.log ).length -1 ){
          var chartist = new Chartist.Bar( '#d_chart', {
            labels: label,
            series: [ data ]
          }, {
            stackBars: true,
            plugins: [
              Chartist.plugins.ctAxisTitle({
                axisX: {
                  axisTitle: '시간 (HH)',
                  axisClass: 'ct-axis-title',
                  offset: {
                    x: 0,
                    y: 30 
                  },
                  textAnchor: 'middle',
                  flipTitle: false
                },
                axisY: {
                  axisTitle: '소요 시간 (sec)',
                  axisClass: 'ct-axis-title',
                  offset: {
                    x: 0,
                    y: -2 
                  },
                  textAnchor: 'middle',
                  flipTitle: false
                }
              })
            ]
          }).on( 'draw', function( data ){
            if( data.type === 'bar' ){
              data.element.attr({ style: 'stroke: ' + config.successColor });

              if( data.value.y >= config.errorValue )
                data.element.attr({ style: 'stroke: ' + config.errorColor });
            }
          });
        }

        c++;
      }
    }
  };

  $(function(){
    func.wsConnect();
    func.click();
  });

  $( window ).on( 'beforeunload', function(){
    window.svcmon[ 'ws' ].close();
    return;     
  });
})();
