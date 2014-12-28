Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

var randomIsOn;

var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                       .getInterface(Components.interfaces.nsIWebNavigation)
                       .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                       .rootTreeItem
                       .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                       .getInterface(Components.interfaces.nsIDOMWindow);

function createSidebarItem(aType) {
  const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  var item = document.createElementNS(XUL_NS, aType); // create a new XUL menuitem
  //item.setAttribute("label", aLabel);
  //dump("created item \n");
  return item;
}

//+ Jonas Raoni Soares Silva
//@ http://jsfromhell.com/array/shuffle [v1.0]
function shuffle(o){ //v1.0
    for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

function unavail(){
	alert("This feature is currently unavailable");
}

function scanPage(){
        mainWindow.netflixRandomizer.scanPage();
}

function selectAll() {
	var sidebarPlaylist = document.getElementById("listbox2");
	var listItems = sidebarPlaylist.getElementsByTagName("listitem");
	for (var i = 0, num = listItems.length; i < num; i++){
		listItems[i].setAttribute('selected',true);
	}
}

function clearSidebar() {
	// var sidebarOnPage = document.getElementById("listbox1");
	// var listItems = sidebarOnPage.getElementsByTagName("listitem");
	// for (var i = 0, num = listItems.length; i < num; i++){
	// 	listItems[0].parentNode.removeChild(listItems[0]);
	// }
	
	var sidebarPlaylist = document.getElementById("listbox2");
	var listItems = sidebarPlaylist.getElementsByTagName("listitem");
	for (var i = 0, num = listItems.length; i < num; i++){
		listItems[0].parentNode.removeChild(listItems[0]);
	}
}

function updatePlaylist() {
			clearSidebar();
			//dump("START playlist update \n");
			// var sidebarOnPage = document.getElementById("listbox1");
			var sidebarPlaylist = document.getElementById("listbox2");
			
			var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
			var mDBConn = Services.storage.openDatabase(file);
			
// 			var statement = mDBConn.createStatement("SELECT * FROM onpage");
		
// 			//dump("got vbox1 \n");
// 			var i = 1;
// 			try{
// 			while(statement.executeStep()){
// 				var name = statement.getString(5);
// 				name = name.replace(/\\/g, "");
// 				var li = createSidebarItem("listitem");
// 				li.setAttribute("id",statement.getString(0));
// 				li.setAttribute("class",statement.getString(1));
// 				li.setAttribute("url",statement.getString(6));
// //				li.setAttribute("ep",statement.getString(4));
// //				li.setAttribute("name",statement.getString(name));
// //				li.setAttribute("title",statement.getString(2));
// //				li.setAttribute("season",statement.getString(3));
//         		var l1 = createSidebarItem("listcell");
// 				l1.setAttribute("label",statement.getString(4));
//         		li.appendChild(l1);
//         		var l2 = createSidebarItem("listcell");
// 				l2.setAttribute("label",name);
//         		li.appendChild(l2);
//         		var l3 = createSidebarItem("listcell");
// 				l3.setAttribute("label",statement.getString(2));
//         		li.appendChild(l3);
//         		var l4 = createSidebarItem("listcell");
// 				l4.setAttribute("label",statement.getString(3));
//         		li.appendChild(l4);
// 				sidebarOnPage.appendChild(li);
// 				i++;
// 			}
// 			}finally{
// 				statement.reset();
// 			}
			
			var statement2 = mDBConn.createStatement("SELECT * FROM playlist");
			var statement3 = mDBConn.createStatement("SELECT cvid FROM status");
			statement3.executeStep();
			var cvid = statement3.getString(0);
			statement3.reset();
		
			//dump("got vbox1 \n");
			var i = 1;
			try{
			while(statement2.executeStep()){
				var name = statement2.getString(5);
				name = name.replace(/\\/g, "");
				var li = createSidebarItem("listitem");
				li.setAttribute("id",statement2.getString(0));
				li.setAttribute("vid",statement2.getString(1));
				//for styling
					if (statement2.getString(1) == cvid){
						li.setAttribute("class","currently-playing");
					}
				li.setAttribute("url",statement2.getString(6));
        		var l1 = createSidebarItem("listcell");
				l1.setAttribute("label",statement2.getString(4));
        		li.appendChild(l1);
        		var l2 = createSidebarItem("listcell");
				l2.setAttribute("label",name);
        		li.appendChild(l2);
        		var l3 = createSidebarItem("listcell");
				l3.setAttribute("label",statement2.getString(2));
        		li.appendChild(l3);
        		var l4 = createSidebarItem("listcell");
				l4.setAttribute("label",statement2.getString(3));
        		li.appendChild(l4);
				sidebarPlaylist.appendChild(li);
				i++;
			}
			}finally{
				statement2.reset();
			}
			//dump("END playlist update \n");
			mDBConn.close();
}

function addToPlaylist() {
	//dump("adding to playlist \n");
	var sidebarOnPage = document.getElementById("listbox1");
	var listItems = sidebarOnPage.getElementsByTagName("listitem");
	//dump("got vars \n");
	var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
	var mDBConn = Services.storage.openDatabase(file);
	try{
	for (var i = 0; i < listItems.length; i++){
		if (listItems[i].getAttribute('selected')){
		//dump(listItems[i].getAttribute('id')+"\n");
		var listCells = listItems[i].getElementsByTagName("listcell");
		mDBConn.executeSimpleSQL("DELETE FROM onpage WHERE pid="+listItems[i].getAttribute('id'));
		//dump("deleted from onpage table \n");
		//dump(listItems[i].getAttribute('class')+"\n");
		mDBConn.executeSimpleSQL('INSERT INTO playlist(pid,vid,title,season,ep,name,url,watched) VALUES(' + null + ',' + listItems[i].getAttribute('class') + ',"' + listCells[2].getAttribute('label') + '",' + listCells[3].getAttribute('label') + ',' + listCells[0].getAttribute('label') + ',"' + listCells[1].getAttribute('label') + '","' + listItems[i].getAttribute('url') + '",0)');
		//dump("adding to playlist table \n");
		}
	}
	//dump("done adding to playlist \n");
	mDBConn.close();
	
	}catch(err){
		dump("add to playlist error: "+err+"\n");	
	}
	updatePlaylist();
}

function removeFromPlaylist() {
	var sidebarPlaylist = document.getElementById("listbox2");
	var listItems = sidebarPlaylist.getElementsByTagName("listitem");
			
	var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
	var mDBConn = Services.storage.openDatabase(file);
	
	for (var i = 0; i < listItems.length; i++){
		if (listItems[i].getAttribute('selected')){
		//dump(listItems[i].getAttribute('id')+"\n");
		mDBConn.executeSimpleSQL("DELETE FROM playlist WHERE pid="+listItems[i].getAttribute('id'));
		}
	}
	
	mDBConn.close();
	updatePlaylist();
}

function playVid() {
	var sidebarPlaylist = document.getElementById("listbox2");
	var selectedVids = sidebarPlaylist.getElementsByTagName("listitem");

	//REDIRECT
	//dump(selectedVids[0].getAttribute('url') + "\n");
	var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
	var mDBConn = Services.storage.openDatabase(file);
	var counter = 0;
	for (var i = 0; i < selectedVids.length; i++){
		if (selectedVids[i].getAttribute('selected')){
			mDBConn.executeSimpleSQL("UPDATE status SET playing=1, cvid="+ selectedVids[i].getAttribute('vid') +" WHERE id=1");
			mDBConn.close();
			counter++;
			mainWindow.openUILinkIn(selectedVids[i].getAttribute('url'), "current", false);
		}
	}
	if (counter == 0){
		alert("Please select a video from playlist");	
	}
}

function randomizer() {
	if (!randomIsOn){
		var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
		var mDBConn = Services.storage.openDatabase(file);
		
		var playlistVids = shuffle(document.getElementsByTagName('listitem'));
		for (var i=0, il=playlistVids.length; i<il; i++) {
					mDBConn.executeSimpleSQL('INSERT INTO current_playlist(cpid,pid) VALUES(' + null + ',' + playlistVids[i].getAttribute('id') + ')');
				}
		mDBConn.close();
		
		randomIsOn = true;
		//mainWindow.openUILinkIn("http://www.randomon.com", "current", false);
	}else{
		randomIsOn = false;
		//mainWindow.openUILinkIn("randomOFF", "current", false);
	}
}

function resetOnPage() {
	var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
	var mDBConn = Services.storage.openDatabase(file);
			
	mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS onpage");
	mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS onpage (pid INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, title TEXT, season INTEGER, ep INTEGER, name TEXT, url TEXT)");
	
	mDBConn.close();
	updatePlaylist();
}

function resetPlaylist() {
	var file = FileUtils.getFile("ProfD", ["netflixrandomizer.sqlite"]);
	var mDBConn = Services.storage.openDatabase(file);
			
	mDBConn.executeSimpleSQL("DROP TABLE IF EXISTS playlist");
	mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS playlist (pid INTEGER PRIMARY KEY AUTOINCREMENT, vid INTEGER, title TEXT, season INTEGER, ep INTEGER, name TEXT, url TEXT, watched INTEGER)");
	
	mDBConn.close();
	updatePlaylist();
}

var playlist = {
    onLoad: function(e) {
		window.top.document.getElementById("netflix-randomizer-toolbar-button").id = "netflix-randomizer-toolbar-button-on";
        //alert('load');
		// var sidebarOnPage = document.getElementById("listbox1");
		// sidebarOnPage.addEventListener("dblclick", function(event)
		// {
		//   var target = event.target;
		//   while (target && target.localName != "listitem")
		// 	target = target.parentNode;
		//   if (!target)
		// 	return;   // Event target isn't a list item
		
		//   addToPlaylist();
		// }, false);
		
		var sidebarPlaylist = document.getElementById("listbox2");
		sidebarPlaylist.addEventListener("dblclick", function(event)
		{
		  var target = event.target;
		  while (target && target.localName != "listitem")
			target = target.parentNode;
		  if (!target)
			return;   // Event target isn't a list item
		
		  playVid();
		}, false);
				
		updatePlaylist();
    },
	onFocus: function(e) {
		//alert('got focus');
		updatePlaylist();
	},
    onUnload: function(e) {
        //alert('close');
		window.top.document.getElementById("netflix-randomizer-toolbar-button-on").id = "netflix-randomizer-toolbar-button";
    }
}

mainWindow.document.addEventListener("UpdateSidebar", function(e) { updatePlaylist(); }, false, true);
// The last value is a Mozilla-specific value to indicate untrusted content is allowed to trigger the event.

window.addEventListener("load", function(e) { playlist.onLoad(e); }, false);
window.addEventListener("focus", function(e) { playlist.onFocus(e); }, false);
window.addEventListener("unload", function(e) { playlist.onUnload(e); }, false);