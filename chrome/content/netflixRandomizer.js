Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");

var randomIsOn;
var scanBobCount = 0;

function updatePage() {
var head = content.document.getElementsByTagName("head")[0];
var style = content.document.getElementById("netflix-randomizer-style");
if (!style) {
		style = content.document.createElement("link");
		style.id = "netflix-randomizer-style";
		style.type = "text/css";
		style.rel = "stylesheet";
		style.href = "chrome://netflixrandomizer/skin/skin.css";
		head.appendChild(style);
}
  var cBody = content.document.getElementsByTagName("body")[0];
  if (cBody.getAttribute("id") == "page-WiMovie"){
	var epCol = content.document.getElementsByClassName("episodeList")[0];
	var addForm = document.createElement("form");
	addForm.setAttribute("action","")
	addForm.setAttribute("class","addList")
	  
	var vIDs = content.document.getElementsByTagName("li");
	for (var i2=0, il2=vIDs.length; i2<il2; i2++) {
		elm = vIDs[i2];
		if (elm.getAttribute("data-episodeid")) {
			var img = document.createElement("input");
			img.setAttribute("type","checkbox");
			img.setAttribute("name","videos");
			img.setAttribute("class","addVid");
			img.setAttribute("value",elm.getAttribute("data-episodeid"));
			//img.value = elm.getAttribute("data-episodeid");
			//img.innerHTML = "add this episode";
			addForm.appendChild(img);
		}
	}
	epCol.parentNode.appendChild(addForm);
  }
}

function installButton(toolbarId, id, afterId) {
    if (!document.getElementById(id)) {
        var toolbar = document.getElementById(toolbarId);
 
        // If no afterId is given, then append the item to the toolbar
        var before = null;
        if (afterId) {
            var elem = document.getElementById(afterId);
            if (elem && elem.parentNode == toolbar)
                before = elem.nextElementSibling;
        }
 
        toolbar.insertItem(id, before);
        toolbar.setAttribute("currentset", toolbar.currentSet);
        document.persist(toolbar.id, "currentset");
 
        if (toolbarId == "addon-bar")
            toolbar.collapsed = false;
    }
}

var netflixRandomizer = function () {
	dump("initial init \n");
	var prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	return {
		init : function () {
			var firstRun = prefManager.getBoolPref("extensions.netflixrandomizer.firstrun");
			if (!firstRun) {
				installButton("nav-bar", "netflix-randomizer-toolbar-button");
				// The "addon-bar" is available since Firefox 4
				//installButton("addon-bar", "my-extension-addon-bar-button");
				prefManager.setBoolPref("extensions.netflixrandomizer.firstrun",true);
			}
			
			Components.utils.import("resource://gre/modules/Services.jsm");
			Components.utils.import("resource://gre/modules/FileUtils.jsm");
			 
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
			
			mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS onpage (pid INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, title TEXT, season INTEGER, ep INTEGER, name TEXT, url TEXT)");
			mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS status (id INTEGER PRIMARY KEY AUTOINCREMENT, playing INTEGER, random INTEGER, cvid INTEGER)");
			//check if table is empty
				var statement = mDBConn.createStatement("SELECT COUNT(*) FROM status");
				statement.executeAsync({
				  handleResult: function(resultSet)
				  {
					var row = resultSet.getNextRow();
					var count = row.getResultByIndex(0);
					//dump("count = "+count+"\n");
					  if (count == 0){
						  mDBConn.executeSimpleSQL("INSERT INTO status(id,playing,random,cvid) VALUES(" + null + ",0,0,0)");
					  }
				  },
				  handleError: function(error) {},
				  handleCompletion: function(reason) {}
				});
				
				// Close connection once the pending operations are completed
				
			//mDBConn = Services.storage.openDatabase(file);
			mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS playlist (pid INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, title TEXT, season INTEGER, ep INTEGER, name TEXT, url TEXT, watched INTEGER)");
			mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS current_playlist (cpid INTEGER PRIMARY KEY AUTOINCREMENT, pid INTEGER)");
			mDBConn.asyncClose();
			//updatePage();
			gBrowser.addEventListener("load", netflixRandomizer.onPageLoad, true);
			//gBrowser.addEventListener("unload", netflixRandomizer.onPageUnload, true);
			gBrowser.addProgressListener(myListener);
			//open sidebar on init
			//toggleSidebar('viewNRSidebar',true);
			dump("done init \n");
		},
		
		uninit : function () {
			toggleSidebar();
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
			
			mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS onpage");
			mDBConn.close();
			gBrowser.removeEventListener("load", netflixRandomizer.onPageLoad, false);
			gBrowser.removeProgressListener(myListener);
			dump("done uninit \n");
		},

		run : function () {
			dump("running \n");
			var head = content.document.getElementsByTagName("head")[0],
				style = content.document.getElementById("netflix-randomizer-style"),
				allLinks = content.document.getElementsByTagName("a"),
				foundLinks = 0;
				
			var episodes = content.document.getElementsByClassName("btn-play"),
				vIDs = content.document.getElementsByTagName("li"),
				episodeLinks = new Array(),
				episodeIDs = new Array(),
				episodeNames = new Array(),
				episodeNum = new Array();

			if (!style) {
				style = content.document.createElement("link");
				style.id = "netflix-randomizer-style";
				style.type = "text/css";
				style.rel = "stylesheet";
				style.href = "chrome://netflixrandomizer/skin/skin.css";
				head.appendChild(style);
			}
			
			for (var i=0, il=episodes.length; i<il; i++) {
				elm = episodes[i];
				if (elm.getAttribute("data-vid") == "") {
					dump(elm.getAttribute("href") + "\n");
					episodeLinks.push(elm.getAttribute("href"));
					//window.location(elm.getAttribute("href"));
					var paramhref = elm.getAttribute("href");
					//mDBConn.executeSimpleSQL("INSERT INTO playlist(url) VALUES('" + param + "')");
				}
			}
			for (var i2=0, il2=vIDs.length; i2<il2; i2++) {
				elm = vIDs[i2];
				if (elm.getAttribute("data-episodeid")) {
					dump(elm.getAttribute("data-episodeid") + "\n");
					episodeIDs.push(elm.getAttribute("data-episodeid"));
					//var parameid = elm.getAttribute("data-episodeid");
					//mDBConn.executeSimpleSQL("INSERT INTO playlist(vid) VALUES('" + param + "')");
					
					episodeNum.push(elm.getElementsByClassName("seqNum")[0].innerHTML); //seqNum
					//dump(elm.getElementsByClassName("seqNum")[0].innerHTML + "\n");
					var epTitle = elm.getElementsByClassName("episodeTitle")[0].innerHTML;
					epTitle = mysql_real_escape_string(epTitle);
					episodeNames.push(epTitle);
					dump(epTitle + "\n");
				}
			}
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
			var title = content.document.getElementsByClassName("title")[0].innerHTML;
			var season = content.document.getElementsByClassName("selectorTxt")[0].innerHTML;
			
			//var lastId = mDBConn.createStatement("SELECT pid FROM playlist ORDER BY pid DESC LIMIT 1");
			//dump(lastId.getString(0) + "\n");
			
			for (var i3=0, il3=episodeIDs.length; i3<il3; i3++) {
				mDBConn.executeSimpleSQL('INSERT INTO playlist(pid,vid,title,season,ep,name,url,watched) VALUES(' + null + ',' + episodeIDs[i3] + ',"' + title + '",' + season + ',' + episodeNum[i3] + ',"' + episodeNames[i3] + '","' + episodeLinks[i3] + '",0)');
			}
			mDBConn.close();
			
			alert("Added videos to playlist!");
			
			var maxEps = episodes.length;
			if (maxEps > 0){
			  var randomEP = Math.floor(Math.random() * (maxEps - 0 + 1)) + 0;
			  dump(episodeLinks[randomEP] + "\n");
			  //REDIRECT
			  //openUILinkIn(episodeLinks[randomEP], "current", false);
			}else{
				alert("Cannot find any movies");
			}

			for (var i=0, il=allLinks.length; i<il; i++) {
				elm = allLinks[i];
				if (elm.getAttribute("title")) {
					elm.className += ((elm.className.length > 0)? " " : "") + "netflix-randomizer-selected";
					elm.
					foundLinks++;
				}
			}
			if (foundLinks === 0) {
				//alert("No links found with a target attribute");
			}
			else {
				//alert("Found " + foundLinks + " links with a target attribute");
			}
		},

		insertCSS : function () {
			var head = content.document.getElementsByTagName("head")[0];
			var style = content.document.getElementById("netflix-randomizer-style");
			if (!style) {
				style = content.document.createElement("link");
				style.id = "netflix-randomizer-style";
				style.type = "text/css";
				style.rel = "stylesheet";
				style.href = "chrome://netflixrandomizer/skin/skin.css";
				head.appendChild(style);
			}
		},

		insertGlobalElements : function () {

			var existingMenuItem = content.document.getElementById("showPlaylist");

			if (!existingMenuItem) {
				var mainMenu = content.document.getElementById("global-header");

				var playlistMenuItem = content.document.createElement("li");
				playlistMenuItem.setAttribute("class", "nav-playlist nav-item dropdown-trigger");
				playlistMenuItem.setAttribute("id", "nav-playlist");
				
				var innerSpan = content.document.createElement("span");
				innerSpan.setAttribute("class", "i-b content");
				
				var innerLink = content.document.createElement("a");
				innerLink.setAttribute("id","showPlaylist");
				innerLink.setAttribute("href","javascript:void(0)");
				innerLink.innerHTML = "Playlist";

				innerSpan.appendChild(innerLink);
				playlistMenuItem.appendChild(innerSpan);
				mainMenu.appendChild(playlistMenuItem);
			}

		},

		insertHomeElements : function () {

		},

		insertPageElements : function () {
			var episodeList = content.document.getElementById("episodeColumn").getElementsByClassName("episodeList")[0].getElementsByTagName("li");
			
			for (var i = episodeList.length - 1; i >= 0; i--) {

				if (episodeList[i].getElementsByClassName("addBtn").length < 1) {
					// var playButton = episodeList[i].getElementsByClassName("playBtn")[0];
					var titleElement = episodeList[i].getElementsByClassName("episodeTitle")[0];

					var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
					var mDBConn = Services.storage.openDatabase(file);

					var element = content.document.createElement("span");
					element.setAttribute("class", "addBtn");
					element.setAttribute("vid", episodeList[i].getAttribute("data-episodeid"));
					element.setAttribute("data-episodeid", episodeList[i].getAttribute("data-episodeid"));
					element.setAttribute("seqNum", episodeList[i].getElementsByClassName("seqNum")[0].innerHTML);
					element.setAttribute("episodeTitle", episodeList[i].getElementsByClassName("episodeTitle")[0].innerHTML);
					element.setAttribute("episodeLink", episodeList[i].getElementsByClassName("playBtn")[0].getElementsByTagName("a")[0].getAttribute("href"));
					// element.innerHTML = "+";
					episodeList[i].insertBefore(element, titleElement);

					//Remove all event listeners
					var el = episodeList[i],
					    elClone = el.cloneNode(true);

					el.parentNode.replaceChild(elClone, el);
					}
					// episodeList[i].addEventListener('click', function() { var addToPlaylistEvent = new Event('AddToPlaylistEvent'); this.dispatchEvent(addToPlaylistEvent); alert("Done!");}, false);
			};
		},

		showPlaylist : function () {
			// var file = new FileUtils.File("/playlist.html");
			// // Content type hint is useful on mobile platforms where the filesystem
			// // would otherwise try to determine the content type.
			// var channel = NetUtil.newChannel(file);
			// channel.contentType = "text/html";

			// NetUtil.asyncFetch(channel, function(inputStream, status) {
			//   content.document.getElementsByTagName('body')[0].innerHTML = inputStream.contentCharset;
			// });

			toggleSidebar('viewNRSidebar',true);

			var mainContentContainer = content.document.getElementById("displaypage-body");
			var headerContainer = mainContentContainer[0];
			var contentContainer = mainContentContainer[1];
		},
		
		getCats : function () {
			dump("getting categories dump\n");
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
				
			var catRows = content.document.getElementsByClassName("mrow");
			
				for (var i=0;i<catRows.length;i++){
					var titleElement = catRows[i].getElementsByTagName("h3")[0];
					//var urlElement = catRows[i].getElementsByTagName("a")[0];
					var title = "Category";
					if (titleElement.getElementsByTagName("a")[0]){
						title = trimString(titleElement.getElementsByTagName("a")[0].innerHTML);
					}else{
						title = trimString(titleElement.innerHTML);
					}
						//var url = urlElement.getAttribute("href");
						//var vid = gup("movieid",url);
						var vid = i;
						//dump("title: "+title+" url: "+url+"\n");
				var check = mDBConn.createStatement("SELECT vid FROM playlist WHERE vid=" + vid);
				//dump("sql done \n");
				var id = 0;
				//dump("checking sql \n");
				try{
				while(check.executeStep()){
					id = check.getString(0);
					//dump(id+"\n");
				}
				}finally{
				check.reset();
				}
				var check2 = mDBConn.createStatement("SELECT vid FROM onpage WHERE vid=" + vid);
				//dump("sql2 done \n");
				var id2 = 0;
				//dump("checking sql2 \n");
				try{
				while(check2.executeStep()){
					id2 = check2.getString(0);
					//dump(id+"\n");
				}
				}finally{
				check.reset();
				}
				//dump("done checking sql "+id+"\n");
				if (id == 0 && id2 == 0) {
				  var statement;
				  try{
					  //dump("index of" + movieTitle.indexOf("\"")+"\n");
					  //doesnt work. for switching between strings with ' and "
					  if (title.indexOf("\"") == -1){
					  	 statement = mDBConn.createStatement('INSERT INTO onpage(pid,vid,title,season,ep,name,url) VALUES(:null1,:vID,:movieTitle,0,0,:movieTitle,:vID)');
					  }else{
						 statement = mDBConn.createStatement("INSERT INTO onpage(pid,vid,title,season,ep,name,url) VALUES(:null1,:vID,:movieTitle,0,0,:movieTitle,:vID)"); 
					  }
					  statement.params.vID = vid;
					  statement.params.movieTitle = title;
					  //statement.params.actualLink = url;
					  statement.params.null1 = null;
					  statement.execute();
					  statement.reset();
				  }catch(err){
					  dump("SQL error "+err+"\n");
					  dump(vid+"\n");
					  dump(title+"\n");
					  //dump(url+"\n");
				  }
				}
					  dump("Cat SQL dump \n");
					  dump(vid+"\n");
					  dump(title+"\n");
					  //dump(url+"\n");
			//dump("about to close sql \n");
		}
  
	  try{
		  mDBConn.asyncClose();
	  }catch(err){
		  dump("SQL close error "+err+"\n");
	  }
		
		dump("done scanning categories!");
			
		},
		
		scanHome : function () {
			dump("home scan dump\n");
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
				
			var boxes = content.document.getElementsByClassName("boxShot");
			
			for (var i=0;i<boxes.length;i++){
				var titleElement = boxes[i].getElementsByTagName("img")[0];
				var urlElement = boxes[i].getElementsByTagName("a")[0];
				var title = titleElement.getAttribute("alt");
				var url = urlElement.getAttribute("href");
				var vid = gup("movieid",url);
						//dump("title: "+title+" url: "+url+"\n");
				
				
				var check = mDBConn.createStatement("SELECT vid FROM playlist WHERE vid=" + vid);
				//dump("sql done \n");
				var id = 0;
				//dump("checking sql \n");
				try{
					while(check.executeStep()){
						id = check.getString(0);
						//dump(id+"\n");
					}
				}finally{
					check.reset();
				}
				var check2 = mDBConn.createStatement("SELECT vid FROM onpage WHERE vid=" + vid);
				//dump("sql2 done \n");
				var id2 = 0;
				//dump("checking sql2 \n");
				try{
					while(check2.executeStep()){
						id2 = check2.getString(0);
						//dump(id+"\n");
					}
				}finally{
					check.reset();
				}
				//dump("done checking sql "+id+"\n");
				if (id == 0 && id2 == 0) {
				  var statement;
				  	try{
						//dump("index of" + movieTitle.indexOf("\"")+"\n");
						//doesnt work. for switching between strings with ' and "
						if (title.indexOf("\"") == -1){
						  statement = mDBConn.createStatement('INSERT INTO onpage(pid,vid,title,season,ep,name,url) VALUES(' + null + ',:vID,:movieTitle,0,0,:movieTitle,:actualLink)');
						}else{
							statement = mDBConn.createStatement("INSERT INTO onpage(pid,vid,title,season,ep,name,url) VALUES(" + null + ",:vID,:movieTitle,0,0,:movieTitle,:actualLink)"); 
						}
					  	statement.params.vID = vid;
					  	statement.params.movieTitle = title;
					  	statement.params.actualLink = url;
					  	statement.execute();
					  	statement.reset();
			  		}catch(err){
					  dump("SQL error "+err+"\n");
					  dump(vid+"\n");
					  dump(title+"\n");
					  dump(url+"\n");
			  		}
				}
					  //dump("SQL dump \n");
					  //dump(vid+"\n");
					  //dump(title+"\n");
					  //dump(url+"\n");
			//dump("about to close sql \n");
			}
  
			try{
				mDBConn.asyncClose();
			}catch(err){
				dump("SQL close error "+err+"\n");
			}
		
			dump("done scanning home page!");
		},
		
		scanPage : function () {
			
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
			
			//mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS onpage");
			//mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS onpage (pid INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, title TEXT, season INTEGER, ep INTEGER, name TEXT, url TEXT)");
				
			var episodes = content.document.getElementsByClassName("btn-play"),
				vIDs = content.document.getElementsByTagName("li"),
				episodeLinks = new Array(),
				episodeIDs = new Array(),
				episodeNames = new Array(),
				episodeNum = new Array();
			
			for (var i=0, il=episodes.length; i<il; i++) {
				var elm = episodes[i];
				if (elm.getAttribute("data-vid") == "") {
					//dump(elm.getAttribute("href") + "\n");
					episodeLinks.push(elm.getAttribute("href"));
					//window.location(elm.getAttribute("href"));
					var paramhref = elm.getAttribute("href");
					//mDBConn.executeSimpleSQL("INSERT INTO playlist(url) VALUES('" + param + "')");
				}
			}
			for (var i2=0, il2=vIDs.length; i2<il2; i2++) {
				elm = vIDs[i2];
				if (elm.getAttribute("data-episodeid")) {
					//dump(elm.getAttribute("data-episodeid") + "\n");
					episodeIDs.push(elm.getAttribute("data-episodeid"));
					//var parameid = elm.getAttribute("data-episodeid");
					//mDBConn.executeSimpleSQL("INSERT INTO playlist(vid) VALUES('" + param + "')");
					
					episodeNum.push(elm.getElementsByClassName("seqNum")[0].innerHTML); //seqNum
					//dump(elm.getElementsByClassName("seqNum")[0].innerHTML + "\n");
					var epTitle = elm.getElementsByClassName("episodeTitle")[0].innerHTML;
					//remove quotes
					//epTitle = epTitle.replaceAll("^\"|\"$", "");
					epTitle = mysql_real_escape_string(epTitle);
					//dump(epTitle + "\n");
					episodeNames.push(epTitle);
				}
			}
			var titles = content.document.getElementsByClassName("title");
			var title;
			for (var i = 0; i < titles.length; i++) {
				if (titles[i].tagName == "H1" && titles[i].innerHTML.length > 0)
				{
					title = titles[i].innerHTML;
				}
			}
			var season = content.document.getElementsByClassName("selectorTxt")[0].innerHTML;

			//var lastId = mDBConn.createStatement("SELECT pid FROM playlist ORDER BY pid DESC LIMIT 1");
			//dump(lastId.getString(0) + "\n");
			//dump("starting sql length  = "+episodeIDs.length+" \n");
			for (var i3=0, il3=episodeIDs.length; i3<il3; i3++) {
				var check = mDBConn.createStatement("SELECT vid FROM playlist WHERE vid=" + episodeIDs[i3]);
				//dump("sql done \n");
				var id = 0;
				//dump("checking sql \n");
				try{
				while(check.executeStep()){
					id = check.getString(0);
					//dump(id+"\n");
				}
				}finally{
				check.reset();
				}
				
				var check2 = mDBConn.createStatement("SELECT vid FROM onpage WHERE vid=" + episodeIDs[i3]);
				//dump("sql done \n");
				var id2 = 0;
				//dump("checking sql \n");
				try{
				while(check2.executeStep()){
					id2 = check2.getString(0);
					//dump(id+"\n");
				}
				}finally{
				check2.reset();
				}
				//dump("done checking sql "+ i3 +" \n");
				if (id == 0 && id2 == 0) {
				  var statement;
				  try{
					  //dump("index of" + title.indexOf("\"")+"\n");
					  //doesnt work. for switching between strings with ' and "
					  if (title.indexOf("\"") == -1){
					  	statement = mDBConn.createStatement('INSERT INTO onpage(pid,vid,title,season,ep,name,url) VALUES(' + null + ',' + episodeIDs[i3] + ',:title,' + season + ',' + episodeNum[i3] + ',"' + episodeNames[i3] + '","' + episodeLinks[i3] + '")');
					  }else{
						 statement = mDBConn.createStatement("INSERT INTO onpage(pid,vid,title,season,ep,name,url) VALUES(" + null + "," + episodeIDs[i3] + ",:title," + season + "," + episodeNum[i3] + ",'" + episodeNames[i3] + "','" + episodeLinks[i3] + "')"); 
					  }
					  statement.params.title = title;
					  statement.execute();
					  statement.reset();
				  }catch(err){
					  dump("SQL error "+err+"\n");
					  dump(episodeIDs[i3]+"\n");
					  dump(statement.params.title+"\n");
					  dump(season+"\n");
					  dump(episodeNum[i3]+"\n");
					  dump(episodeNames[i3]+"\n");
					  dump(episodeLinks[i3]+"\n");
				  }
				}
			}
			//dump("about to close sql \n");
			try{
				mDBConn.asyncClose();
			}catch(err){
				dump("SQL close error "+err+"\n");
			}
			
			
			
			dump("Done scanning page! \n");
			//alert("Done scanning page!");
		},
		
		scanBob : function () {
			//dump("running \n");
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
			
			//mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS onpage");
			//mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS onpage (pid INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, title TEXT, season INTEGER, ep INTEGER, name TEXT, url TEXT)");

			//var movie = content.document.getElementById("BobMovie");
			var	vID;
			var movieLinks = content.document.getElementsByClassName("playLink");
			var	mdpLinks = content.document.getElementsByClassName("mdpLink");
			var	movieLink = content.document.getElementsByClassName("mdpLink")[0].getAttribute("href");
			var actualLink = "#";
			//dump("movie link "+movieLink+"\n");
			var	movieTitle = "movie";
			if (content.document.getElementsByClassName("title")[0]){
			movieTitle = content.document.getElementsByClassName("title")[0].innerHTML;
			//actualLink = content.document.getElementsByClassName("title")[0].parentNode.getAttribute("href");
			}
				
				for (var iii = 0;iii < mdpLinks.length;iii++){
					if (mdpLinks[iii].parentNode.getAttribute("class") == "bobMovieHeader clearfix"){
						//dump(mdpLinks[iii].parentNode.getAttribute("class")+"\n");
						actualLink = mdpLinks[iii].getAttribute("href");
						//dump("actual link "+actualLink+"\n");
					}
					
				}
				//////
				var sURL = actualLink.split("?");
				//for (var i1 = 0;i1<sURL.length;i1++){
					//dump(sURL[i1]+"\n");
				//}
				vID = sURL[0].split("/");
				//for (var i = 0;i<vID.length;i++){
					//dump(vID[i]+"\n");
				//}
				
				for (var i=0;i<movieLinks.length;i++){
					var tempID = gup("movieid",movieLinks[i].getAttribute("href"));
					//dump("temp id= "+tempID+"\n");
					if (tempID == vID[5]){
						actualLink = movieLinks[i].getAttribute("href");
					//dump("actual link= "+actualLink+"\n");	
					}
				}
				////////
				var check = mDBConn.createStatement("SELECT vid FROM playlist WHERE vid=" + vID[5]);
				dump("sql done \n");
				var id = 0;
				dump("checking sql \n");
				try{
				while(check.executeStep()){
					id = check.getString(0);
					//dump(id+"\n");
				}
				}finally{
				check.reset();
				}
				var check2 = mDBConn.createStatement("SELECT vid FROM onpage WHERE vid=" + vID[5]);
				dump("sql2 done \n");
				var id2 = 0;
				dump("checking sql2 \n");
				try{
				while(check2.executeStep()){
					id2 = check2.getString(0);
					//dump(id+"\n");
				}
				}finally{
				check.reset();
				}
				dump("done checking sql "+id+"\n");
				if (id == 0 && id2 == 0) {
				  var statement;
				  try{
					  //dump("index of" + movieTitle.indexOf("\"")+"\n");
					  //doesnt work. for switching between strings with ' and "
					  if (movieTitle.indexOf("\"") == -1){
					  	 statement = mDBConn.createStatement('INSERT INTO onpage(pid,vid,title,season,ep,name,url) VALUES(' + null + ',:vID,:movieTitle,0,0,:movieTitle,:actualLink)');
					  }else{
						 statement = mDBConn.createStatement("INSERT INTO onpage(pid,vid,title,season,ep,name,url) VALUES(" + null + ",:vID,:movieTitle,0,0,:movieTitle,:actualLink)"); 
					  }
					  statement.params.vID = vID[5];
					  statement.params.movieTitle = movieTitle;
					  statement.params.actualLink = actualLink;
					  statement.execute();
					  statement.reset();
				  }catch(err){
					  dump("SQL error "+err+"\n");
					  dump(vID[5]+"\n");
					  dump(movieTitle+"\n");
					  dump(actualLink+"\n");
				  }
				}
					  dump("SQL dump \n");
					  dump(vID[5]+"\n");
					  dump(movieTitle+"\n");
					  dump(actualLink+"\n");
			//dump("about to close sql \n");
			try{
				mDBConn.asyncClose();
			}catch(err){
				dump("SQL close error "+err+"\n");
			}
			
			
			
			dump("Done scanning bob! \n");
			//alert("Done scanning page!");
		},
		
		addToPlaylist : function (elm) {
			//dump("adding to playlist \n");

			var episodeLink, episodeID, episodeName, episodeNum;

			episodeID = elm.getAttribute("data-episodeid");
			episodeNum = elm.getAttribute("seqNum");
			episodeName = elm.getAttribute("episodeTitle");
			episodeLink = elm.getAttribute("episodeLink");

			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);

			var titles = content.document.getElementsByClassName("title");
			var title;
			for (var i = 0; i < titles.length; i++) {
				if (titles[i].tagName == "H1" && titles[i].innerHTML.length > 0)
				{
					title = titles[i].innerHTML;
				}
			}
			var season = content.document.getElementsByClassName("selectorTxt")[0].innerHTML;
			
			
			try{
				mDBConn.executeSimpleSQL('INSERT INTO playlist(pid,vid,title,season,ep,name,url,watched) VALUES(' + null + ',' + episodeID + ',"' + title + '",' + season + ',' + episodeNum + ',"' + episodeName + '","' + episodeLink + '",0)');
			}catch(err){
				dump("add to playlist error: "+err+"\n");	
			}

			mDBConn.close();
			
			// alert("Added " + title + " " + episodeName + " to playlist!");

			var evt = document.createEvent("Events");
			evt.initEvent("UpdateSidebar", true, false);
			elm.dispatchEvent(evt);

		},
		
		playPlaylist : function (vid) {
			dump("starting playlist with vid:"+vid+"\n");
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
			try{
			var check = mDBConn.createStatement("SELECT * FROM status WHERE id=1");
				var playing = 0;
				var pvid = 0;
				try{
				check.executeStep();
					playing = check.getString(1);
					pvid = check.getString(3);
					dump("pvid = "+pvid+"\n");
				
				}finally{
					check.reset();
				}
				
				if (vid != pvid){
					var getURL = mDBConn.createStatement("SELECT vid,url FROM playlist");
					try{
					while(getURL.executeStep()){
						if (getURL.getString(0) == pvid){
							break;
						}
					}
					getURL.executeStep();
					var purl = getURL.getString(1);
					dump("playing "+purl+" "+getURL.getString(0)+"\n");
	
					mDBConn.executeSimpleSQL("UPDATE status SET playing=1, cvid="+ getURL.getString(0) +" WHERE id=1");
				}catch(error){
						dump("SQL playlist error: "+error+"\n");
					}
					getURL.reset();
					mDBConn.asyncClose();
					openUILinkIn(purl, "current", false);
				}else{
					mDBConn.asyncClose();
				}
			}catch(err){
				dump("Play playlist error "+err+"\n");	
			}

		},
				
		onPageLoad: function(aEvent) {
	  		var doc = aEvent.originalTarget; // doc is document that triggered the event
			var win = doc.defaultView; // win is the window for the doc
			// test desired conditions and do something
			// if (doc.nodeName == "#document") return; // only documents
			// if (win != win.top) return; //only top window.
			// if (win.frameElement) return; // skip iframes/frames
			pathArray = win.location.href.split( '/' );
			protocol = pathArray[0];
			host = pathArray[2];

			if (host != "www.netflix.com") return;

			netflixRandomizer.insertCSS();
			netflixRandomizer.insertGlobalElements();

			if (!win.frameElement)  {
				var autoRun = prefManager.getBoolPref("extensions.netflixrandomizer.autorun");
					if (autoRun) {
						//netflixRandomizer.run();
					}
				var checkElement = doc.getElementsByTagName("body")[0];
				var eid = checkElement.getAttribute("id");
				
				if (eid == "page-WiMovie"){
					dump("Is WiMovie");
					netflixRandomizer.insertPageElements();
					netflixRandomizer.scanPage();
					
					win.addEventListener("unload", function(event){ netflixRandomizer.onPageUnload(event); }, true);
					  // select the target node
					var target = doc.querySelector('.ajaxLoading');
					dump("Creating observer");
					  // create an observer instance
					var observer = new MutationObserver(function(mutations) {
						mutations.forEach(function(mutation) {
							dump("mutation "+mutation.type+" "+scanBobCount+"\n");	  
						});
						//setTimeout(function() {
						if (scanBobCount >= 1){
							toggleSidebar();
							netflixRandomizer.scanPage();
							toggleSidebar('viewNRSidebar',true);
							scanBobCount = 0;
						}else{
							scanBobCount++;
						}
								//}, 100);
					});
					   
					  // configuration of the observer:
					var config = { attributes: true, childList: true, characterData: true }
					   
					  // pass in the target node, as well as the observer options
					observer.observe(target, config);
				  
				}else if (eid == "page-WiPlayer"){
					//dump(gup('movieid',doc.location.href)+"\n");
					dump("on player page LOAD\n")
					toggleSidebar();
					dump("closed sidebar\n");
					toggleSidebar('viewNRSidebar',true);
					dump("opened sidebar\n");
					netflixRandomizer.playPlaylist(gup('movieid',doc.location.href));
				}else if(eid == "page-WiHome"){
					netflixRandomizer.insertHomeElements();

					//netflixRandomizer.scanHome();
					netflixRandomizer.getCats();
					var allowHomeScan = prefManager.getBoolPref("extensions.netflixrandomizer.homescan");
					if (allowHomeScan){
						//
						// SCAN HOME PAGE
						//
						aEvent.originalTarget.defaultView.addEventListener("unload", function(event){ netflixRandomizer.onPageUnload(event); }, true);
						// select the target node
						var target = doc.querySelector('#BobMovie');
						dump("got target "+target+"\n");

						// create an observer instance
						var observer = new MutationObserver(function(mutations) {
						  mutations.forEach(function(mutation) {
							  dump("mutation "+mutation.type+"\n");
							  
						  });

						netflixRandomizer.scanBob();
						});

						// configuration of the observer:
						var config = { attributes: true, childList: true, characterData: true }

						// pass in the target node, as well as the observer options
						observer.observe(target, config);					
					}
				}//end if allow home scan
				//updatePage();
				//alert("page is loaded : " +doc.location.href + "\n");
			}else{
				//if iFrame
				//alert("iframe is loaded \n" +doc.location.href);
			}
		},
		onPageUnload: function(aEvent) {
		  		var doc = aEvent.originalTarget; // doc is document that triggered the event
				var win = doc.defaultView; // win is the window for the doc
				// test desired conditions and do something
				// if (doc.nodeName == "#document") return; // only documents
				// if (win != win.top) return; //only top window.
				// if (win.frameElement) return; // skip iframes/frames
			if (!win.frameElement)  {
				var autoRun = prefManager.getBoolPref("extensions.netflixrandomizer.autorun");
					if (autoRun) {
						//netflixRandomizer.run();
					}
				var checkElement = doc.getElementsByTagName("body")[0];
				var eid = checkElement.getAttribute("id");
				
				if (eid == "page-WiMovie"){
					
					//netflixRandomizer.scanPage();
				}else if (eid == "page-WiPlayer"){
					//dump(gup('movieid',doc.location.href)+"\n");
					//dump("on player page DO SOMETHING:\n")
					//netflixRandomizer.playPlaylist(gup('movieid',doc.location.href));
				}
				//toggle only if on netflix.com
				//toggleSidebar();
				//dump("closed sidebar\n");
				//updatePage();
				//alert("page is unloaded : " +doc.location.href + "\n");
			}else{
				//if iFrame
				//alert("iframe is loaded \n" +doc.location.href);
			}
		}
	};
}();
const STATE_START = Ci.nsIWebProgressListener.STATE_START;
const STATE_STOP = Ci.nsIWebProgressListener.STATE_STOP;
var myListener = {
    QueryInterface: XPCOMUtils.generateQI(["nsIWebProgressListener",
                                           "nsISupportsWeakReference"]),
 
    onStateChange: function(aWebProgress, aRequest, aFlag, aStatus) {
        // If you use myListener for more than one tab/window, use
        // aWebProgress.DOMWindow to obtain the tab/window which triggers the state change
//        if (aFlag & STATE_START) {
//				var checkElement = content.document.getElementsByTagName("body")[0];
//				var eid = checkElement.getAttribute("id");
//				dump("on state "+eid+"\n");
//            // This fires when the load event is initiated
//				if (eid == "page-WiMovie"){
//					
//					netflixRandomizer.scanPage();
//				}else if (eid == "page-WiPlayer"){
//					//dump(gup('movieid',doc.location.href)+"\n");
//					//dump("on player page DO SOMETHING:\n")
//					var location = aWebProgress.DOMWindow.document.location.href;
//					dump(location+"\n");
//					if (location.indexOf("#") != -1){
//						//doc.location doesnt work
//						netflixRandomizer.playPlaylist(getQueryVariable('MovieId',document.location.href));
//					}else{
//					 	netflixRandomizer.playPlaylist(gup('movieid',document.location.href));
//					}
//				}
//        }
//        if (aFlag & STATE_STOP) {
//            // This fires when the load finishes
//        }
    },
 
    onLocationChange: function(aProgress, aRequest, aURI) {

    },
 
    // For definitions of the remaining functions see related documentation
    onProgressChange: function(aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot) {},
    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {},
    onSecurityChange: function(aWebProgress, aRequest, aState) {},
}

function handleClickEvent(e) {
	var target = e.target;

	// alert(target.className);

	if (target.className == "addBtn") {
		netflixRandomizer.addToPlaylist(target);
		// alert("Added");
	}

	if (target.getAttribute("id") == "showPlaylist") {
		netflixRandomizer.showPlaylist();
	}
}

document.addEventListener("click", function(e) { handleClickEvent(e); }, false, true);

window.addEventListener("load", netflixRandomizer.init, false);
window.addEventListener("unload", netflixRandomizer.uninit, false);