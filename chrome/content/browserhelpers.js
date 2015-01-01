function mysql_real_escape_string (str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
				return "\\'";
            case "'":
            case "\\":
            case "%":
                return "\\"+char; // prepends a backslash to backslash, percent,
                                  // and double/single quotes
        }
    });
}

function gup( name, location )
{
  location = location.replace("#","&");
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&#]"+name+"=([^&]*)";
  var regex = new RegExp( regexS );
  //dump("current location "+window.location.href+"\n");
  var results = regex.exec( location );
  //dump("results"+results[1]+" "+results[2]);
  if( results == null )
    return "";
  else
    return results[1];
}

function getQueryVariable(variable,location)
{ 
  //dump("begin get query\n")
  //var query = location.search.substring(1);
  var query = location;
  //dump("query "+query+"\n")
  var initSplit =  query.split("#")
//  for (var ii=0;ii<initSplit.length;ii++){
//  dump("init split "+initSplit[ii]+"\n");
//  }
  var vars = initSplit[1].split("&"); 
  for (var i=0;i<vars.length;i++)
  { 
    var pair = vars[i].split("="); 
    if (pair[0] == variable)
    { 
      return pair[1]; 
    } 
  }
  return -1; //not found 
}

var QueryString = function () {
  // This function is anonymous, is executed immediately and 
  // the return value is assigned to QueryString!
  var query_string = {};
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
      // If first entry with this name
    if (typeof query_string[pair[0]] === "undefined") {
      query_string[pair[0]] = pair[1];
      // If second entry with this name
    } else if (typeof query_string[pair[0]] === "string") {
      var arr = [ query_string[pair[0]], pair[1] ];
      query_string[pair[0]] = arr;
      // If third or later entry with this name
    } else {
      query_string[pair[0]].push(pair[1]);
    }
  } 
    return query_string;
} ();

function trimString (str) {
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}

