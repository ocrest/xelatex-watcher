#!/usr/bin/env node

var fs = require( 'fs' );
var gaze = require( 'gaze' );
var path = require( 'path' );
var spawn = require( 'child_process' ).spawn;
var c = require( 'colors' );
var Q = require( 'q' );

var main = process.argv[ 2 ] || 'main.tex';
var main_path = path.dirname( main ) + '/' + path.basename( main, '.tex' );
var pattern = '**/*.{tex,sty,bib}';
var watcher = new gaze( pattern );

console.log( c.green( 'Watching ' ) + c.cyan.bold( process.cwd() + '/' + pattern ) + c.green( '...' ) + '\n' );

function deferredSpawn( command, args ){
    var deferred = Q.defer();
    var call = spawn( command, args ? args : [], { silent: true } );
    var stderr = '', stdout = '';
    call.stdout.on( 'data', function( data ){
        stdout += data.toString();
    });
    call.stderr.on( 'data', function( data ){
        stderr += data.toString();
    });
    call.on( 'exit', function( code ){
        code === 0 ? deferred.resolve() : deferred.reject( stderr.length ? stderr : stdout );
    });
    return deferred.promise;
}

function xelatex(){
    return deferredSpawn( 'xelatex', [ '--halt-on-error', '--interaction=nonstopmode', main_path + '.tex' ] );
}
function pybtex( changed_file ){
    if( ! changed_file || path.extname( changed_file ) !== '.bib' )
        return Q.resolve();
    return deferredSpawn( 'pybtex', [ main_path + '.aux' ] ).then( xelatex ).then( xelatex );
}

function rebuild( event, filepath ){
    var now = new Date(),
        h = ( '0' + now.getHours() ).slice( -2 ),
        m = ( '0' + now.getMinutes() ).slice( -2 ),
        s = ( '0' + now.getSeconds() ).slice( -2 );
    if( event ){
        process.stdout.write( c.cyan( '[' + c.bold( h + ':' + m + ':' + s ) + '] ' ) );
        var status = event == 'added' ? c.green( 'added' ) : event == 'changed' ? c.yellow( 'modified' ) : c.red( 'deleted' );
        process.stdout.write( c.green( filepath ) + '  ' + status + '\n' );
    }
    process.stdout.write( ' — ' + c.cyan( 'Rebuilding the document... ' ) );
    xelatex()
        .then( pybtex.bind( undefined, filepath ) )
        .then(function(){
            console.log( c.green( 'done' ) );
        })
        .fail(function( err ){
            console.log( c.red( 'failed' ) );
            console.error( c.red( err.toString() ) );
        });
};

watcher.on( 'all', rebuild );
rebuild();
