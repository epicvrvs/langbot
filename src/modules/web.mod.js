var lastUrl = [];

function fixedFromCharCode (codePt) {
    if (codePt > 0xFFFF) {
        codePt -= 0x10000;
        return String.fromCharCode(0xD800 + (codePt >> 10), 0xDC00 + (codePt & 0x3FF));
    } else {
        return String.fromCharCode(codePt);
    }
}

exports.setup = function(bot) {
  bot.listen(function(from,msg) {
    var m = msg.match(/\bhttps?:\/\/\S+/);
    if (m) lastUrl = lastUrl.concat(m).slice(-50);
  });
  
  bot.addCommand('title', {
    usage: '.title [url], .title',
    help: 'get title of [url], or title of last mentioned url',
    args: /^(https?:\/\/\S+)?$/,
    action: function(from,respond,url) {
      if (!url) {
        if (!lastUrl.length) return respond ('no url');
        url = lastUrl.pop();
      }
      bot.wget(url, function (error, response, body) {
        if (error) return respond('error: '+String(error));
        if(response.headers['content-type'].substr(0,9)!='text/html') return respond('content-type: '+response.headers['content-type'] + ' | '+url);
        
        var title = body.extract(/<title\s*>\s*(.*?)\s*<\/title\s*>/i,'$1').htmldecode() || 'could not find title';
        return respond(title + ' | ' + url );
      });
    }
  })

  bot.addCommand('u', {
    
    usage: '.u [search terms]',
    help: 'lookup unicode table',
    args: /^(.+)$/,
    action: function(from,respond,text) {
      if (!text) return respond ('You gave me zero length input.');
      var re = /<a.*?>(.*?)<\/a>.*?<a.*?>U\+(.*?)<\/a><\/td>.*?<td>(.*?)<\/td>/;
      
      
      bot.wget('http://www.fileformat.info/info/unicode/char/search.htm?preview=none', {
        q:text,
      }, function(error,response,body,url) {
        if (error) return respond('error: '+ String(error));
        
        var res = body.clean()
        .extract(/<tr class="row[01]">(.*?)<\/tr>/g,'$1')
        .extract(/<a.*?>(.*?)<\/a>.*?<a.*?>U\+(.*?)<\/a><\/td>.*?<td>(.*?)<\/td>/,function($0,$1,$2,$3) {
          var code = 'U+'+$2;
          var name = $3.toLowerCase();
          var C = parseInt($2,16);
          var char = fixedFromCharCode(C);
          if (char == text) char = ''+char+'';
          var html = '&#'+C+';';
          return char + ' ('+code + ' '+html+' '+name + ') |';
        })
        .filter(Boolean)
        .unique();
        respond.flush(res.length ? res : 'not found');
      })
    }
  })

  
  bot.addCommand('urban', {
    usage: '.urban [search terms]',
    help: 'search urban dictionary',
    args: /^(.+)$/,
    action: function(from,respond,text) {
      if (!text) return respond ('You gave me zero length input.');
      bot.wget('http://www.urbandictionary.com/define.php', {
        term:text
      }, function(error,response,body,url) {
        if (error) return respond('error',String(error));
        
        var res = body.clean().split(/<td class='word'[^>]*>/)
        .extract(/^(.*?)<\/td>.*?<div class="definition">(.*?)<\/div>/i, '$1: $2')
        .filter(Boolean).map(function(n) {
          return String(n).htmlstrip();
        });
        respond.flushbr(res.length ? res : 'not found');
      });
    }
  })

  bot.addCommand('imdb', {
    usage: '.imdb [movie]',
    args: /^(.+)$/,
    help: 'get information about a movie on imdb',
    action: function(from,respond,text) {
      if (!text) {
        return respond('You gave me zero length input.');
      }
      bot.wget('http://www.imdbapi.com/', {
          t:text
        }, function (error, response, body) {
        if (error) return respond('error: '+String(error));
        try { var obj = JSON.parse(body); } catch(e) { return('error: ' + String(e)); }
        if (!obj.Title) return respond('nothing found ');
        return respond( obj.Title + ' (' + obj.Year + ')' + ' | ' + obj.imdbRating + ' | ' + 'http://imdb.com/title/' + obj.imdbID + ' | ' + obj.Plot );
      });
    }
  });

  bot.addCommand('twit', {
    usage: '.twit [search terms]',
    help: 'show the latest tweet',
    args: /^(.+)$/,
    action: function(from,respond,text) {
      bot.wget('http://twitter.com/search/realtime', {
        q:text
      }, function (error, response, body,url) {
        if (error) return respond('error: '+String(error));
        var res = body.clean()
        .extract(/<div class="tweet\b[^>]*>(.*?)<\/strong>(.*?)<\/b>(.*?)<\/small>(.*?)<div class="stream-item-footer">/g,'$3 ago | $2 ($1): $4 ')
        .filter(Boolean).map(function(n) {
          return n.htmlstrip().replace(/\( /,'(');
        })
        respond.flushbr(res.length ? res : 'not found');
      });
    }
  });
};
