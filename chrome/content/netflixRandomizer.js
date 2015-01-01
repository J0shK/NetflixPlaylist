Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

var playlistEnum = {
	DEFAULT : 0,
	SHUFFLE : 1,
	QUICK : 2
}

var randomIsOn;
var scanBobCount = 0;
var scanSeasonsCount = 0;
var scanningSeasons = false;
var shuffleSeasons = false;

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

//+ Jonas Raoni Soares Silva
//@ http://jsfromhell.com/array/shuffle [v1.0]
function shuffleArray(o){ //v1.0
    for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

var netflixRandomizer = function () {
	dump("initial init \n");
	var prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	return {
		init : function () {
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);

			var firstRun = prefManager.getBoolPref("extensions.netflixrandomizer.firstrun");
			if (!firstRun) {
				installButton("nav-bar", "netflix-randomizer-toolbar-button");
				// The "addon-bar" is available since Firefox 4
				//installButton("addon-bar", "my-extension-addon-bar-button");
				prefManager.setBoolPref("extensions.netflixrandomizer.firstrun",true);
			}

			var version;
			if (prefManager.getPrefType("extensions.netflixrandomizer.version")) {
				version = prefManager.getIntPref("extensions.netflixrandomizer.version");
			}

			if (!version)
			{
				prefManager.setIntPref("extensions.netflixrandomizer.version",1);
			}

			//Migrate to version 1
			if (true)
			{
				mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS onpage");
				mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS current_playlist");

				//Actually needs migration methods
				// mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS status");
				// mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS playlist");
				//Doesnt need anything - New table since v1
				// mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS quick_playlist");
			}
			
			mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS status (id INTEGER PRIMARY KEY AUTOINCREMENT, current_playlist INTEGER)");
			//check if table is empty
			var statement = mDBConn.createStatement("SELECT COUNT(*) FROM status");
			statement.executeStep();
			var count = statement.getString(0);
				//dump("count = "+count+"\n");
			if (count == 0){
				mDBConn.executeSimpleSQL("INSERT INTO status(id,current_playlist) VALUES(" + null + ",0)");
			}

			mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS video (id INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, title TEXT, season INTEGER, ep INTEGER, name TEXT, url TEXT, watch_count INTEGER)");
			
			mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS playlist (id INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, playing INTEGER)");
			mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS quick_playlist (id INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, playing INTEGER)");

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
			// var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			// var mDBConn = Services.storage.openDatabase(file);
			// mDBConn.close();
			gBrowser.removeEventListener("load", netflixRandomizer.onPageLoad, false);
			gBrowser.removeProgressListener(myListener);
			dump("done uninit \n");
		},

		run : function () {

		},

		// ---######--- HTML Injections ---######---

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
			var mainMenu = content.document.getElementById("global-header");

			if (!existingMenuItem && mainMenu) {
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


			var bodyContent = content.document.getElementById("displaypage-bodycontent");
			var actualContent = bodyContent.children[0];
			var seasonSelector = actualContent.children[0];
			var pin = actualContent.children[1];

			if (pin.getAttribute("id") != "playPlaylist") {
				var playButton = content.document.createElement("button");
				playButton.setAttribute("id", "playPlaylist");
				playButton.setAttribute("class", "netflix-randomizer-page-button");
				playButton.innerHTML = "Play Series";
				actualContent.insertBefore(playButton, pin);

				var shuffleButton = content.document.createElement("button");
				shuffleButton.setAttribute("id", "shufflePlaylist");
				shuffleButton.setAttribute("class", "netflix-randomizer-page-button");
				shuffleButton.innerHTML = "Shuffle Series";
				actualContent.insertBefore(shuffleButton, pin);
			}

		},

		// --- ###### --- Playlist --- ###### ---

		showPlaylist : function () {
			// var file = new FileUtils.File("/playlist.html");
			// // Content type hint is useful on mobile platforms where the filesystem
			// // would otherwise try to determine the content type.
			// var channel = NetUtil.newChannel(file);
			// channel.contentType = "text/html";

			// NetUtil.asyncFetch(channel, function(inputStream, status) {
			//   content.document.getElementsByTagName('body')[0].innerHTML = inputStream.contentCharset;
			// });

			// toggleSidebar('viewNRSidebar',true);

			// var mainContentContainer = content.document.getElementById("displaypage-body");
			// var headerContainer = mainContentContainer.childNodes[0];
			// var contentContainer = mainContentContainer.childNodes[1];

			// headerContainer.innerHTML = "";

			// contentContainer.innerHTML = "";

			content.document.location.href = "chrome://netflixrandomizer/content/playlist.html";
		},

		constructPlaylist : function () {
			var playlistList = content.document.getElementById("playlistList");

			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
			
			var statement = mDBConn.createStatement("SELECT * FROM playlist");

		
			var i = 1;
			try{
				while(statement.executeStep()){
					var vid = statement.getString(1)
					var video = mDBConn.createStatement("SELECT * FROM video WHERE id="+vid);
					video.executeStep();
					var name = video.getString(5);
					name = name.replace(/\\/g, "");


					var li = content.document.createElement("li");

					li.setAttribute("id",video.getString(0));
					li.setAttribute("vid",video.getString(1));
					//for styling
						if (statement.getString(2) == 1){
							li.setAttribute("class","currently-playing");
						}
					// li.setAttribute("url",statement2.getString(6));

					var linkElement = content.document.createElement("a");
					linkElement.setAttribute("href",video.getString(6)+"&playlist=1&pid=0&vid="+statement.getString(0));

	        		var l1 = content.document.createElement("span");
					l1.setAttribute("class","episode"); //episode #
					l1.innerHTML = video.getString(4);
	        		linkElement.appendChild(l1);

	        		var l2 = content.document.createElement("span");
					l2.setAttribute("class","episode-name"); // episode title
					l2.innerHTML = name;
	        		linkElement.appendChild(l2);

	        		var l3 = content.document.createElement("span");
					l3.setAttribute("class","title"); //series title
					l3.innerHTML = video.getString(2);
	        		linkElement.appendChild(l3);

	        		var l4 = content.document.createElement("span");
					l4.setAttribute("class", "season"); //season
					l4.innerHTML = video.getString(3);
	        		linkElement.appendChild(l4);

	        		li.appendChild(linkElement);
					playlistList.appendChild(li);
					i++;
					video.reset();
				}
			}catch(err){
				dump("Construction error: "+err+" \n");
			}finally{
				statement.reset();
			}
			//dump("END playlist update \n");
			mDBConn.close();
		},

		currentPlaylistId: function (conn) {
			var mDBConn = conn;
			if (!mDBConn) {
				var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
				mDBConn = Services.storage.openDatabase(file);
			}
			
			var check = mDBConn.createStatement("SELECT playlist FROM status WHERE id=1");
			var pid = 0;
			try{
				check.executeStep();
				pid = check.getString(0);
			}finally{
				check.reset();
			}

			if (!conn) {
				mDBConn.close();
			}
			
			return pid;
		},

		currentPlaylistName: function (conn) {
			var mDBConn = conn;
			if (!mDBConn) {
				var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
				mDBConn = Services.storage.openDatabase(file);
			}
			var check = mDBConn.createStatement("SELECT playlist FROM status WHERE id=1");
			var pid = 0;
			try{
				check.executeStep();
				pid = check.getString(0);
			}finally{
				check.reset();
			}

			if (!conn) {
				mDBConn.close();
			}
			var name = "";
			switch(pid) {
				case playlistEnum.DEFAULT:
					name = "playlist";
					break;
				case playlistEnum.SHUFFLE:
					name = "quick_playlist";
					break;
				case playlistEnum.QUICK:
					name = "quick_playlist";
					break;
				default:
					name = "playlist";
					break;
			}

			return name;
		},
		getPlaylistNameForID: function (pid) {
			var name = "";
			switch(parseInt(pid)) {
				case playlistEnum.DEFAULT:
					name = "playlist";
					break;
				case playlistEnum.SHUFFLE:
					name = "quick_playlist";
					break;
				case playlistEnum.QUICK:
					name = "quick_playlist";
					break;
				default:
					name = "playlist";
					break;
			}

			return name;
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
			var existingID;
			try{
				var check = mDBConn.createStatement("SELECT id FROM video WHERE vid="+episodeID);
				check.executeStep();
				existingID = check.getString(0);
				check.reset();
			}catch(err){
				dump("Video doesnt exist in db \n")
				
				mDBConn.executeSimpleSQL('INSERT INTO video(id,vid,title,season,ep,name,url,watch_count) VALUES(' + null + ',' + episodeID + ',"' + title + '",' + season + ',' + episodeNum + ',"' + episodeName + '","' + episodeLink + '",0)');
				check = mDBConn.createStatement("SELECT id FROM video WHERE vid="+episodeID);
				check.executeStep();
				existingID = check.getString(0);
				dump("added video and got id:"+existingID+"\n");
			}finally{
				mDBConn.executeSimpleSQL('INSERT INTO playlist(id,vid,playing) VALUES(' + null + ',' + existingID + ',0)');
				dump("added video to playlist \n");
			}

			mDBConn.close();
			
			// alert("Added " + title + " " + episodeName + " to playlist!");
			netflixRandomizer.updateSidebar(elm);
		},

		shufflePlaylist : function (pid) {
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
			var pName = netflixRandomizer.getPlaylistNameForID(pid);
			var statement = mDBConn.createStatement("SELECT * FROM "+pName);
			//pid INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, title TEXT, season INTEGER, ep INTEGER, name TEXT, url TEXT, watched INTEGER
			var playlist = new Array();
			var i = 1;
			try{
				while(statement.executeStep()){
					var video = new Array();
					video["id"] = statement.getString(0);
					video["vid"] = statement.getString(1);
					video["playing"] = statement.getString(2);
					playlist.push(video);
					i++;
				}
			}finally{
				statement.reset();
			}

			mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS quick_playlist");
			mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS quick_playlist (id INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, playing INTEGER)");

			playlist = shuffleArray(playlist);

			for (var i = 0; i < playlist.length; i++) {
				try{
					mDBConn.executeSimpleSQL('INSERT INTO quick_playlist(id,vid,playing) VALUES(' + null + ',' + playlist[i]["vid"] + ',"' + playlist[i]["playing"] + '")');
				}catch(err){
					dump("add to playlist error: "+err+"\n");	
				}
			}
			var purl;
			try{
				//Get first url
				dump("fist vid:"+playlist[0]["vid"]+"\n");
				var getURL = mDBConn.createStatement("SELECT url FROM video WHERE id="+playlist[0]["vid"]);
				getURL.executeStep();
				purl = getURL.getString(0);
			}catch(err){
				dump("Error fetching URL "+err+"\n");
			}

			//dump("END playlist update \n");
			mDBConn.close();

			// netflixRandomizer.constructPlaylist();
			openUILinkIn(purl+"&playlist=1&pid=1&vid=1", "current", false);
		},

		setVideoIsPlaying : function (pid,pvid) {
			dump("Starting to set as playing pid:"+pid+" pvid:"+pvid+"\n");
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
			var currentPlaylistName = netflixRandomizer.getPlaylistNameForID(pid);
			try{
				mDBConn.executeSimpleSQL("UPDATE "+ currentPlaylistName +" SET playing=0 WHERE playing=1");
				mDBConn.executeSimpleSQL("UPDATE "+ currentPlaylistName +" SET playing=1 WHERE id="+pvid);
			}catch(error){
				dump("SQL set playing error: "+error+"\n");
			}

			mDBConn.close();
		},
		
		playPlaylist : function (pid,next) {
			dump("starting playlist with pid:"+pid+"\n");
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
			var currentPlaylistName = netflixRandomizer.getPlaylistNameForID(pid);

			var purl;
			var pvid = 0;
			var newID;
			var success = false;

			try{
				//Get last video
				var check = mDBConn.createStatement("SELECT * FROM "+ currentPlaylistName +" WHERE playing=1");
				var id = 0;
				check.executeStep();
				id = check.getString(0);
				pvid = check.getString(1);
				check.reset();

				if (next){
					//Mark last video as watched
					mDBConn.executeSimpleSQL("UPDATE video SET watch_count=watch_count+1 WHERE id="+pvid);

					//Get next video
					var getNext = mDBConn.createStatement("SELECT id,vid FROM "+ currentPlaylistName);

					while(getNext.executeStep()){
						if (getNext.getString(0) == id){
							break;
						}
					}
					var errorGettingNext;
					try{
						getNext.executeStep();
						id = getNext.getString(0);
						pvid = getNext.getString(1);
					}catch(err){
						dump("error getting next video in playlist");
						errorGettingNext = true;
					}finally{
						getNext.reset();
					}
				}



				// mDBConn.executeSimpleSQL("UPDATE "+ currentPlaylistName +" SET playing=0 WHERE playing=1");
				// mDBConn.executeSimpleSQL("UPDATE "+ currentPlaylistName +" SET playing=1 WHERE id="+newID);

				var getURL = mDBConn.createStatement("SELECT url FROM video WHERE id="+ pvid);
				getURL.executeStep();
				purl = getURL.getString(0);

				success = true;
					
			}catch(error){
				dump("SQL playlist error: "+error+"\n");
			}

			mDBConn.asyncClose();

			if (success && !errorGettingNext){
				openUILinkIn(purl+"&playlist=1&pid="+pid+"&vid="+id, "current", false);
			}else{
				openUILinkIn("chrome://netflixrandomizer/content/playlist.html", "current", false);
			}
		},

		resetPlaylist : function() {
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
					
			mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS playlist");
			mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS playlist (id INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, playing INTEGER)");

			mDBConn.close();
			netflixRandomizer.updateSidebar();
		},

		// --- ###### --- Scanning --- ###### ---

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
				// var check2 = mDBConn.createStatement("SELECT vid FROM onpage WHERE vid=" + vid);
				// //dump("sql2 done \n");
				// var id2 = 0;
				// //dump("checking sql2 \n");
				// try{
				// 	while(check2.executeStep()){
				// 		id2 = check2.getString(0);
				// 		//dump(id+"\n");
				// 	}
				// }finally{
				// 	check.reset();
				// }
				// //dump("done checking sql "+id+"\n");
				// if (id == 0 && id2 == 0) {
				//   var statement;
				//   	try{
				// 		//dump("index of" + movieTitle.indexOf("\"")+"\n");
				// 		//doesnt work. for switching between strings with ' and "
				// 		if (title.indexOf("\"") == -1){
				// 		  statement = mDBConn.createStatement('INSERT INTO onpage(pid,vid,title,season,ep,name,url) VALUES(' + null + ',:vID,:movieTitle,0,0,:movieTitle,:actualLink)');
				// 		}else{
				// 			statement = mDBConn.createStatement("INSERT INTO onpage(pid,vid,title,season,ep,name,url) VALUES(" + null + ",:vID,:movieTitle,0,0,:movieTitle,:actualLink)"); 
				// 		}
				// 	  	statement.params.vID = vid;
				// 	  	statement.params.movieTitle = title;
				// 	  	statement.params.actualLink = url;
				// 	  	statement.execute();
				// 	  	statement.reset();
			 //  		}catch(err){
				// 	  dump("SQL error "+err+"\n");
				// 	  dump(vid+"\n");
				// 	  dump(title+"\n");
				// 	  dump(url+"\n");
			 //  		}
				// }
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
				var existingID;
				try{
					var check = mDBConn.createStatement("SELECT id FROM video WHERE vid="+episodeIDs[i3]);
					check.executeStep();
					existingID = check.getString(0);
					check.reset();
				}catch(err){
					dump("Video doesnt exist in db \n")
					
					var statement;
					  try{
						//dump("index of" + title.indexOf("\"")+"\n");
						//doesnt work. for switching between strings with ' and "
						if (title.indexOf("\"") == -1){
							statement = mDBConn.createStatement('INSERT INTO video(id,vid,title,season,ep,name,url,watch_count) VALUES(' + null + ',' + episodeIDs[i3] + ',:title,' + season + ',' + episodeNum[i3] + ',"' + episodeNames[i3] + '","' + episodeLinks[i3] + '",0)');
						}else{
							statement = mDBConn.createStatement("INSERT INTO video(id,vid,title,season,ep,name,url,watch_count) VALUES(" + null + "," + episodeIDs[i3] + ",:title," + season + "," + episodeNum[i3] + ",'" + episodeNames[i3] + "','" + episodeLinks[i3] + "',0)"); 
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
					check = mDBConn.createStatement("SELECT id FROM video WHERE vid="+episodeIDs[i3]);
					check.executeStep();
					existingID = check.getString(0);
					dump("added video and got id:"+existingID+"\n");
				}finally{
					mDBConn.executeSimpleSQL('INSERT INTO quick_playlist(id,vid,playing) VALUES(' + null + ',' + existingID + ',0)');
					dump("added video to playlist \n");
				}

			}
			//dump("about to close sql \n");
			try{
				mDBConn.close();
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
				// var check2 = mDBConn.createStatement("SELECT vid FROM onpage WHERE vid=" + vID[5]);
				// dump("sql2 done \n");
				// var id2 = 0;
				// dump("checking sql2 \n");
				// try{
				// while(check2.executeStep()){
				// 	id2 = check2.getString(0);
				// 	//dump(id+"\n");
				// }
				// }finally{
				// check.reset();
				// }
				// dump("done checking sql "+id+"\n");
				// if (id == 0 && id2 == 0) {
				//   var statement;
				//   try{
				// 	  //dump("index of" + movieTitle.indexOf("\"")+"\n");
				// 	  //doesnt work. for switching between strings with ' and "
				// 	  if (movieTitle.indexOf("\"") == -1){
				// 	  	 statement = mDBConn.createStatement('INSERT INTO onpage(pid,vid,title,season,ep,name,url) VALUES(' + null + ',:vID,:movieTitle,0,0,:movieTitle,:actualLink)');
				// 	  }else{
				// 		 statement = mDBConn.createStatement("INSERT INTO onpage(pid,vid,title,season,ep,name,url) VALUES(" + null + ",:vID,:movieTitle,0,0,:movieTitle,:actualLink)"); 
				// 	  }
				// 	  statement.params.vID = vID[5];
				// 	  statement.params.movieTitle = movieTitle;
				// 	  statement.params.actualLink = actualLink;
				// 	  statement.execute();
				// 	  statement.reset();
				//   }catch(err){
				// 	  dump("SQL error "+err+"\n");
				// 	  dump(vID[5]+"\n");
				// 	  dump(movieTitle+"\n");
				// 	  dump(actualLink+"\n");
				//   }
				// }
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

		scanSeasons : function (random)
		{
			//Reset
			scanSeasonsCount = 0;
			scanningSeasons = true;
			shuffleSeasons = random;

			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
			
			mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS quick_playlist");
			mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS quick_playlist (id INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, playing INTEGER)");

			mDBConn.close();

			var seasonList = content.document.getElementById("seasonsNav");
			seasonList.children[scanSeasonsCount].click();
			scanSeasonsCount++;

		},

		scanNextSeason : function () {
			netflixRandomizer.scanPage();

			var seasonList = content.document.getElementById("seasonsNav");
			if (scanSeasonsCount < seasonList.children.length){
				seasonList.children[scanSeasonsCount].click();
				scanSeasonsCount++;
			}else{
				scanningSeasons = false;
				if (shuffleSeasons) {
					netflixRandomizer.shufflePlaylist(playlistEnum.QUICK);
					shuffleSeasons = false;
				}else{
					var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
					var mDBConn = Services.storage.openDatabase(file);

					var firstItem = mDBConn.createStatement("SELECT vid FROM quick_playlist WHERE id=1");
					firstItem.executeStep();
					var vid = firstItem.getString(0);
					firstItem.reset();

					var getURL = mDBConn.createStatement("SELECT url FROM video WHERE id="+vid);
					getURL.executeStep();
					var purl = getURL.getString(0);
					getURL.reset();

					mDBConn.close();

					openUILinkIn(purl+"&playlist=1&pid="+playlistEnum.QUICK+"&vid=1", "current", false);

				}
				
			}
		},

		// --- ###### --- Misc. --- ###### ---

		updateSidebar : function(elm) {
			var evt = document.createEvent("Events");
			evt.initEvent("UpdateSidebar", true, false);
			elm.dispatchEvent(evt);
		},
				
		onPageLoad: function(aEvent) {
			dump("netflixRandomizer page did load \n")
	  		var doc = aEvent.originalTarget; // doc is document that triggered the event
			var win = doc.defaultView; // win is the window for the doc
			// test desired conditions and do something
			// if (doc.nodeName == "#document") return; // only documents
			// if (win != win.top) return; //only top window.
			// if (win.frameElement) return; // skip iframes/frames

			var pathArray = win.location.href.split( '/' );
			var protocol = pathArray[0];
			var host = pathArray[2];
			dump("host: "+host+"\n");
			if (host != "www.netflix.com" && host != "netflixrandomizer") return;

			netflixRandomizer.insertCSS();
			netflixRandomizer.insertGlobalElements();

			if (host == "netflixrandomizer") {
				netflixRandomizer.constructPlaylist();
				return;
			}

			var autoRun = prefManager.getBoolPref("extensions.netflixrandomizer.autorun");
				if (autoRun) {
					//netflixRandomizer.run();
				}
			var checkElement = doc.getElementsByTagName("body")[0];
			var eid = checkElement.getAttribute("id");
			dump("eid:"+eid+"\n");
			if (eid == "page-WiMovie"){
				dump("Is WiMovie");
				netflixRandomizer.insertPageElements();
				// netflixRandomizer.scanPage();
				
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
						netflixRandomizer.insertPageElements();
						if (scanningSeasons){
							netflixRandomizer.scanNextSeason();
						}
						// netflixRandomizer.scanPage();
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
				dump("is player \n");
				if (gup('playlist',doc.location.href) > 0){
					dump("Starting to set as playing");
					netflixRandomizer.setVideoIsPlaying(gup('pid',doc.location.href),gup('vid',doc.location.href));
				}
			}else if(eid == "page-WiHome"){
				netflixRandomizer.insertHomeElements();

				//netflixRandomizer.scanHome();
				// netflixRandomizer.getCats();
				var allowHomeScan = prefManager.getBoolPref("extensions.netflixrandomizer.homescan");
				if (allowHomeScan){
					//
					// SCAN HOME PAGE
					//
					// select the target node
					var target = doc.querySelector('#BobMovie');
					dump("got target "+target+"\n");

					// create an observer instance
					var observer = new MutationObserver(function(mutations) {
					  mutations.forEach(function(mutation) {
						  dump("mutation "+mutation.type+"\n");
						  
					  });

					// netflixRandomizer.scanBob();
					});

					// configuration of the observer:
					var config = { attributes: true, childList: true, characterData: true }

					// pass in the target node, as well as the observer options
					observer.observe(target, config);					
				}
			}//end if allow home scan

			win.addEventListener("beforeunload", function(event){ netflixRandomizer.onBeforePageUnload(event); }, true);
			win.addEventListener("unload", function(event){ netflixRandomizer.onPageUnload(event); }, true);
			// doc.addEventListener("mediaplaybackstarted", function(event){ netflixRandomizer.playbackStarted(event); }, true);
		},

		onBeforePageUnload : function (aEvent) {
		  	var doc = aEvent.originalTarget; // doc is document that triggered the event
			var win = doc.defaultView; // win is the window for the doc
			// alert("Before Page unload "+win.location.href);
		},

		playbackStarted : function (aEvent) {
			alert("Playback Started");
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
 
    onLocationChange : function(aProgress, aRequest, aURI) {
    	// This fires when the location bar changes; that is load event is confirmed
        // or when the user switches tabs. If you use myListener for more than one tab/window,
        // use aProgress.DOMWindow to obtain the tab/window which triggered the change.
        // alert("location change "+aURI.spec.toString(0)+"\n");

		var checkElement = content.document.getElementsByTagName("body")[0];
		var eid = checkElement.getAttribute("id");
		dump("on location "+aURI.spec.toString(0)+"\n");
		if (eid == "page-WiMovie"){
			
			// netflixRandomizer.scanPage();
		}else if (eid == "page-WiPlayer"){
			//dump(gup('movieid',doc.location.href)+"\n");
			//dump("on player page DO SOMETHING:\n")
			if (gup('playlist',aURI.spec.toString(0)) > 0){
				netflixRandomizer.playPlaylist(gup('pid',aURI.spec.toString(0)),true);
			}

		}
    },
 
    // For definitions of the remaining functions see related documentation
    onProgressChange: function(aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot) {},
    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {},
    onSecurityChange: function(aWebProgress, aRequest, aState) {},
}

function handleClickEvent(e) {
	var target = e.target;

	// alert(target.getAttribute("id"));

	var checkElement = content.document.getElementsByTagName("body")[0];
	var eid = checkElement.getAttribute("id");
	
	if (eid == "page-WiMovie"){
		if (target.className == "addBtn") {
			netflixRandomizer.addToPlaylist(target);
			// alert("Added");
		}

		if (target.getAttribute("id") == "playPlaylist") {
			netflixRandomizer.scanSeasons(false);
		}

		if (target.getAttribute("id") == "shufflePlaylist") {
			netflixRandomizer.scanSeasons(true);
		}
	}
	else if (eid == "page-WiHome") {

	}
	else if (eid == "page-WiPlayer") {
		
	}
	else if (eid == "page-WiPlaylist") {
		if (target.getAttribute("id") == "shuffle"){
			netflixRandomizer.shufflePlaylist(playlistEnum.DEFAULT);
		}
		if (target.getAttribute("id") == "play") {
			netflixRandomizer.playPlaylist(playlistEnum.DEFAULT,false);
		}
		if (target.getAttribute("id") == "clear") {
			netflixRandomizer.resetPlaylist();
		}
	}



	if (target.getAttribute("id") == "showPlaylist") {
		netflixRandomizer.showPlaylist();
	}
}

document.addEventListener("click", function(e) { handleClickEvent(e); }, false, true);

window.addEventListener("load", netflixRandomizer.init, false);
window.addEventListener("unload", netflixRandomizer.uninit, false);