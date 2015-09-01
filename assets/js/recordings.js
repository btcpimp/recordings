var recording = false, //if in browser recording is happening
		recorder = null, //recorder
		recordTimer = null, //setInterval reference recorder timer
		startTime = null, //recorder start time
		soundBlob = {}, //sound Blobs from in-browser recording
		soundList = (typeof soundList === "undefined") ? {} : soundList, //sound file list, we attempt to get this from the page
		language = $("#language").val(); //selected language

var temp;
generateList();
$("#recordings-frm").submit(function(e) {
	e.preventDefault();
	var data = {
		module: "recordings",
		command: "save"
	};

	if($("#name").val().trim() === "") {
		return warnInvalid($("#name"),_("You must set a valid name for this recording"));
	}
	data.name = $("#name").val().trim();

	data.id = $("#id").val();

	//convert the list before a submit
	convertList();

	if(isObjEmpty(soundList)) {
		alert(_("No files have been added to this recording"));
		return false;
	}
	data.soundlist = JSON.stringify(soundList);

	data.combine = $("input[name=combine]:checked").val();

	data.description = $("#description").val();

	data.codecs = [];
	$(".codec:checked").each(function() {
		data.codecs.push($(this).val());
	});

	data.fcode = $("#fcode-link-yes1").length && $("#fcode-link-yes1").is(":checked") ? 1 : 0;
	data.fcode_pass = $("#fcode_pass").length ? $("#fcode_pass").val() : "";

	$("#action-buttons input").prop("disabled",true);
	temp = data;

	$.ajax({
		type: 'POST',
		url: "ajax.php",
		data: data,
		dataType: 'json',
		timeout: 30000,
		success: function(data) {
			if(data.status) {
				window.location = "?display=recordings";
			} else {
				alert(data.message);
				console.log(data.errors);
				$("#action-buttons input").prop("disabled", false);
			}
		},
		error: function(data) {
			alert(_("An Error occurred trying to submit this document"));
			$("#action-buttons input").prop("disabled", false);
		},
	});
});
//check if this browser supports WebRTC
//TODO: This eventually needs to check to make sure we are in HTTPS mode
if (Modernizr.getusermedia) {
	//show in browser recording if it does
	$("#record-container").removeClass("hidden");
	$("#jquery_jplayer_1").jPlayer({
		ready: function(event) {

		},
		timeupdate: function(event) {
			$("#jp_container_1").find(".jp-ball").css("left",event.jPlayer.status.currentPercentAbsolute + "%");
		},
		ended: function(event) {
			$("#jp_container_1").find(".jp-ball").css("left","0%");
		},
		swfPath: "http://jplayer.org/latest/dist/jplayer",
		supplied: "wav",
		wmode: "window",
		useStateClassSkin: true,
		autoBlur: false,
		keyEnabled: true,
		remainingDuration: true,
		toggleDuration: true
	});
	var acontainer = null;
	$('.jp-play-bar').mousedown(function (e) {
		acontainer = $(this).parents(".jp-audio-freepbx");
		updatebar(e.pageX);
	});
	$(document).mouseup(function (e) {
		if (acontainer) {
			updatebar(e.pageX);
			acontainer = null;
		}
	});
	$(document).mousemove(function (e) {
		if (acontainer) {
			updatebar(e.pageX);
		}
	});

	//update Progress Bar control
	function updatebar(x) {
		var player = $("#" + acontainer.data("player")),
				progress = acontainer.find('.jp-progress'),
				maxduration = player.data("jPlayer").status.duration,
				position = x - progress.offset().left,
				percentage = 100 * position / progress.width();

		//Check within range
		if (percentage > 100) {
			percentage = 100;
		}
		if (percentage < 0) {
			percentage = 0;
		}

		player.jPlayer("playHead", percentage);

		//Update progress bar and video currenttime
		acontainer.find('.jp-ball').css('left', percentage+'%');
		acontainer.find('.jp-play-bar').css('width', percentage + '%');
		player.jPlayer.currentTime = maxduration * percentage / 100;
	};
} else {
	//hide in browser recording if it does not
	$("#record-container").remove();
}

//Language change
$("#language").change(function() {
	//conver the list into an object
	convertList();
	//change our global language
	language = $("#language").val();
	//now regenerate the list
	generateList();
	//change the text of language to our selected language for clarification
	$(".language").text($(this).find("option:selected").text());
});

//Make sure at least one codec is selected
$(".codec").change(function() {
	if(!$(".codec").is(":checked")) {
		alert(_("At least one codec must be checked"));
		$(this).prop("checked", true);
	}
});

//Turn on HTML5 Sortable methods on the file list
if($("#files").length) {
	var el = document.getElementById('files'),
			sortable = Sortable.create(el);
}

//enable button click from enter while inside of input-groups
$(".input-group").each(function(k, v) {
	var button = $(this).find(".input-group-btn button");
	$(this).find("input").keyup(function (e) {
		if (e.keyCode == 13) {
			$(this).off("blur");
			button.click();
		}
	});
});

//Stop recording if we are (recording) and the play/stop button was clicked
$(".jp-play").click(function() {
	if(recording) {
		$("#record").click();
	}
});

/**
 * Record from within WebRTC supported browser
 */
$("#record").click(function() {
	var counter = $("#jp_container_1 .jp-duration"),
			title = $("#jp_container_1 .jp-title"),
			player = $("#jquery_jplayer_1"),
			controls = $(this).parents(".jp-controls"),
			recorderContainer = $("#browser-recorder"),
			saveContainer = $("#browser-recorder-save"),
			input = $("#save-recorder-input");

	controls.toggleClass("recording");
	player.jPlayer( "clearMedia" );

	//previously recording
	if (recording) {
		clearInterval(recordTimer);
		title.html('<button id="saverecording" class="btn btn-primary" type="button">'+_("Save Recording")+'</button><button id="deleterecording" class="btn btn-primary" type="button">'+_("Delete Recording")+'</button>');
		//save recording button
		$("#saverecording").one("click", function() {
			//clear media for upload
			player.jPlayer( "clearMedia" );
			//hide recorderContainer
			recorderContainer.removeClass("in").addClass("hidden");
			//if we are in replace mode then there's no need to show the naming box
			if($(".replace").length) {
				saveBrowserRecording("replacement-" + Date.now(), function() {
					$("#browser-recorder-save").addClass("hidden").removeClass("in");
					$("#browser-recorder").addClass("in").removeClass("hidden");
					$("#save-recorder-input").val("");
					$("#save-recorder-input").prop("disabled", false);
					$("#save-recorder").text(_("Save!"));
					$("#save-recorder").prop("disabled", false);
					title.html(_("Hit the red record button to start recording from your browser"));
				});
			} else {
				saveContainer.removeClass("hidden").addClass("in");
				//focus on input
				input.focus();
				//dont allow navigating away until they have named this
				input.blur(function(event) {
					if(event.relatedTarget === null || (event.relatedTarget.id != "save-recorder" && event.relatedTarget.id != "cancel-recorder")) {
						alert(_("Please enter a valid name and save"));
						$(this).focus();
					}
				});
				$("#cancel-recorder").off("click");
				$("#cancel-recorder").on("click", function() {
					if(!confirm(_("Are you sure you wish to discard this recording?"))) {
						return;
					}
					$("#jquery_jplayer_1").jPlayer( "clearMedia" );
					$("#browser-recorder-save").addClass("hidden").removeClass("in");
					$("#browser-recorder").addClass("in").removeClass("hidden");
					$("#save-recorder-input").val("");
					$("#save-recorder-input").prop("disabled", false);
					$("#save-recorder").text(_("Save!"));
					$("#save-recorder").prop("disabled", false);
					title.html(_("Hit the red record button to start recording from your browser"));
				});
				$("#save-recorder").off("click");
				$("#save-recorder").on("click", function() {
					var value = input.val();
					if(value === "") {
						alert(_("Please enter a valid name and save"));
						input.focus();
						return;
					}
					if(sysRecConflict(value)) {
						if(!confirm(_("A system recording with this name already exists for this language. Do you want to overwrite it?"))) {
							return;
						}
					}
					$(this).off("click");
					$(this).text(_("Saving..."));
					$(this).prop("disabled", true);
					title.text(_("Uploading..."));
					saveBrowserRecording(value, function(data) {
						$("#jquery_jplayer_1").jPlayer( "clearMedia" );
						$("#browser-recorder-save").addClass("hidden").removeClass("in");
						$("#browser-recorder").addClass("in").removeClass("hidden");
						$("#save-recorder-input").val("");
						$("#save-recorder-input").prop("disabled", false);
						$("#save-recorder").text(_("Save!"));
						$("#save-recorder").prop("disabled", false);
						title.html(_("Hit the red record button to start recording from your browser"));
					});
					input.prop("disabled", true);
				});
			}
		});
		$("#deleterecording").one("click", function() {
			$("#jquery_jplayer_1").jPlayer( "clearMedia" );
			title.html(_("Hit the red record button to start recording from your browser"));
		});
		recorder.stop();
		recorder.exportWAV(function(blob) {
			soundBlob = blob;
			var url = (window.URL || window.webkitURL).createObjectURL(blob);
			player.jPlayer( "setMedia", {
				wav: url
			});
		});
		recording = false;
	} else {
		//map webkit prefix
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		var context = new AudioContext(),
		gUM = Modernizr.prefixed("getUserMedia", navigator);

		//start the recording!
		gUM({ audio: true }, function(stream) {
			var mediaStreamSource = context.createMediaStreamSource(stream);
			//worker is already loaded but it doesnt seem to cause any issues. eh.
			recorder = new Recorder(mediaStreamSource,{ workerPath: "assets/recordings/js/recorderWorker.js" });
			recorder.record();
			startTime = new Date();
			//create a normal minutes:seconds timer from micro/milli-seconds
			recordTimer = setInterval(function () {
				var mil = (new Date() - startTime),
						temp = (mil / 1000),
						min = ("0" + Math.floor((temp %= 3600) / 60)).slice(-2),
						sec = ("0" + Math.round(temp % 60)).slice(-2);
				counter.text(min + ":" + sec);
			}, 1000);
			title.text(_("Recording..."));
			recording = true;
		}, function(e) {
			controls.toggleClass("recording");
			alert(_("Your Browser Blocked The Recording, Please check your settings"));
			recording = false;
		});
	}
});

/**
 * Dial an extension to record
 */
$("#dial-phone").click(function() {
	var num = $("#record-phone").val(),
			file = num + Date.now(),
			checker = null,
			extensionInput = $("#record-phone"),
			nameInput = $("#save-phone-input"),
			messageBox = $("#dialer-message");

	extensionInput.prop("disabled",true);
	$(this).text(_("Dialing..."));

	//Initiate the originate commands
	$.post( "ajax.php", {module: "recordings", command: "dialrecording", extension: num, filename: file}, function( data ) {
		//Asterisk says we dialed a valid number
		if(data.status) {
			extensionInput.val("");
			//hide dialer
			$("#dialer").removeClass("in").addClass("hidden");
			//Show record message
			messageBox.text(_("Recording...")).addClass("in").removeClass("hidden");
			//Wait 500 ms before checking for out file
			setTimeout(function(){
				//every 500 ms check to see if our .finished file exists
				//cleanup is done on the backend
				checker = setInterval(function(){
					$.post( "ajax.php", {module: "recordings", command: "checkrecording", extension: num, filename: file}, function( data ) {
						if(data.finished || (!data.finished && !data.recording)) {
							clearInterval(checker);
							messageBox.removeClass("in").addClass("hidden");
							//if we are in replace mode then there's no need to show the naming box
							if($(".replace").length) {
								saveExtensionRecording(num, file, "replacement-" + Date.now(), function() {
									$("#dialer").addClass("in").removeClass("hidden");
								});
							} else {
								$("#dialer-save").addClass("in").removeClass("hidden");
								nameInput.focus();
								nameInput.blur(function(event) {
									if(event.relatedTarget === null || (event.relatedTarget.id != "save-phone" && event.relatedTarget.id != "cancel-phone")) {
										alert(_("Please enter a valid name and save"));
										$(this).focus();
									}
								});
								$("#cancel-phone").off("click");
								$("#cancel-phone").on("click", function() {
									if(!confirm(_("Are you sure you wish to discard this recordings?"))) {
										return;
									}
									$.post( "ajax.php", {module: "recordings", command: "deleterecording", filenames: JSON.stringify({"temp": file+".wav"})}, function( data ) {
										if(data.status) {
											$("#dialer-save").removeClass("in").addClass("hidden");
											$("#dialer").addClass("in").removeClass("hidden");
										}
									});
								});
								$("#save-phone").on("click", function() {
									var value = nameInput.val();
									if(value === "") {
										alert(_("Please enter a valid name and save"));
										nameInput.focus();
										return;
									}
									if(sysRecConflict(value)) {
										if(!confirm(_("A system recording with this name already exists for this language. Do you want to overwrite it?"))) {
											return;
										}
									}
									$(this).off("click");
									saveExtensionRecording(num, file, value, function() {
										$("#dialer-save").removeClass("in").addClass("hidden");
										$("#dialer").addClass("in").removeClass("hidden");
									});
								});
							}
						}
					});
				}, 500);
			}, 500);
		} else {
			alert(data.message);
		}
		extensionInput.prop("disabled",false);
		$("#dial-phone").text(_("Call!"));
	});
});

/**
 * Drag/Drop/Upload Files
 */
$('#dropzone').on('drop dragover', function (e) {
	e.preventDefault();
});
$('#dropzone').on('dragleave drop', function (e) {
	$(this).removeClass("activate");
});
$('#dropzone').on('dragover', function (e) {
	$(this).addClass("activate");
});
$('#fileupload').fileupload({
	dataType: 'json',
	dropZone: $("#dropzone"),
	add: function (e, data) {
		//TODO: Need to check all supported formats
		var sup = "\.("+supportedRegExp+")$",
				patt = new RegExp(sup),
				submit = true;
		$.each(data.files, function(k, v) {
			if(!patt.test(v.name)) {
				submit = false;
				alert(_("Unsupported file type"));
				return false;
			}
			var s = v.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, '-').toLowerCase();
			if(!$(".replace").length && sysRecConflict(s)) {
				if(!confirm(sprintf(_("File %s will overwrite a file that already exists in this language. Is that ok?"),v.name))) {
					submit = false;
					return false;
				}
			}
		});
		if(submit) {
			data.submit();
		}
	},
	drop: function () {
		$("#upload-progress .progress-bar").css("width", "0%");
	},
	dragover: function (e, data) {
	},
	change: function (e, data) {
	},
	done: function (e, data) {
		if(data.result.status) {
			var paths = {};
			paths[language] = data.result.localfilename;
			addFile(data.result.filename, paths, [language], true, false);
		} else {
			alert(data.result.message);
		}
	},
	progressall: function (e, data) {
		var progress = parseInt(data.loaded / data.total * 100, 10);
		$("#upload-progress .progress-bar").css("width", progress+"%");
	},
	fail: function (e, data) {
	},
	always: function (e, data) {
	}
});

/**
 * System Recordings selector
 */
//System Recordings lookup drop down with search
$("#systemrecording").chosen({search_contains: true, no_results_text: _("No Recordings Found"), placeholder_text_single: _("Select a system recording")});
//On change add the recording into the list
$("#systemrecording").on('change', function(evt, params) {
	var rec = $(this).val(),
			info = systemRecordings[rec],
			languages = [],
			paths = {};

	for (var key in info.languages) {
		if (info.languages.hasOwnProperty(key)) {
			var l = info.languages[key];
			languages.push(l);
			paths[l] = info.paths[l];
		}
	}
	addFile(info.name, paths, languages, (languages.indexOf(language) >= 0), true);
	//reset the drop down to the first empty item
	$('#systemrecording').val("");
	$('#systemrecording').trigger('chosen:updated');
});

/**
 * File List Management
 */
$(document).on("click", "#files .delete-file", function() {
	var $this = this,
			parent = $($this).parents(".file"),
			name = parent.data("name"),
			files = parent.data("filenames");
	$($this).addClass("deleting");
	//dont delete already existing files
	if(parent.data("system") == 1) {
		parent.fadeOut("slow", function() {
			$(this).remove();
			$("#jplayer-file-"+name).remove();
			if(!$("#files .file").length) {
				$("#file-alert").removeClass("hidden");
			}
			checkList();
		})
	} else {
		$.post( "ajax.php", {module: "recordings", command: "deleterecording", filenames: JSON.stringify(files)}, function( data ) {
			if(data.status) {
				parent.fadeOut("slow", function() {
					$(this).remove();
					$("#jplayer-file-"+name).remove();
					if(!$("#files .file").length) {
						$("#file-alert").removeClass("hidden");
					}
					checkList();
				})
			} else {
				alert(data.message);
				$($this).removeClass("deleting");
			}
		});
	}
});

$(document).on("click", "#files li", function(event) {
	if(!$(event.target).hasClass("file")) {
		return;
	}
	if(!$(this).hasClass("replace")) {
		if(!$(this).hasClass("missing") && !confirm(_("You are entering replace mode. The next file you add will replace this one. Are you sure you want to do that?"))) {
			return;
		}
		$(".replace").removeClass("replace")
		$(this).toggleClass("replace");
	} else if($(this).hasClass("replace")) {
		$(this).removeClass("replace");
	}
});

/**
 * Functions below
 */

/**
 * Add File to the file list
 * @param {string} name      The visual name of the file
 * @param {object} paths     Paths for each language representation of this file
 * @param {array} languages Languages that this file supports
 * @param {bool} exists    Does the file exist or not
 * @param {bool} system    Is this a system recording (then dont delete)
 */
function addFile(name, filenames, languages, exists, system) {
	if($(".replace").length) {
		var rfilenames = $(".replace").data("filenames"),
				rlanguages = $(".replace").data("languages")
				name = $(".replace").data("name"),
				player = $("#jplayer-file-"+name);

		//add language to array if it doesnt already exist
		if(rlanguages.indexOf(language) === -1) {
			rlanguages.push(language);
		}

		//add filename to the filename object, overwrite if we need to
		//TODO: If file already exists then delete it
		if(isObjEmpty(rfilenames)) {
			rfilenames = {};
		}
		rfilenames[language] = filenames[language];

		//put our objects back into place
		$(".replace").data("filenames", rfilenames);
		$(".replace").data("languages", rlanguages);

		//remove the marking classes
		$(".replace").removeClass("replace missing");
		player.jPlayer( "clearMedia");
	} else {
		var exists = exists ? "" : "missing ",
				system = system ? 1 : 0;
		$("#file-alert").addClass("hidden");
		$("#files").append('<li id="file-'+name+'" class="file '+exists+'" data-filenames=\''+JSON.stringify(filenames)+'\' data-name="'+name+'" data-system="'+system+'" data-languages=\''+JSON.stringify(languages)+'\'><i class="fa fa-play play hidden"></i> '+name+'<i class="fa fa-times-circle pull-right text-danger delete-file"></i></li>');
		$("#playbacks").append('<div id="jplayer-file-'+name+'" class="jp-jplayer"></div>');
		$("#jplayer-file-"+name).jPlayer({
			ready: function(event) {
				$("#file-"+name+" .play").removeClass("hidden");
			},
			cssSelectorAncestor: "#jp_container_122222",
			swfPath: "http://jplayer.org/latest/dist/jplayer",
			supplied: supportedHTML5
		});
	}
	$("#file-"+name+" .play").off("click");
	$("#file-"+name+" .play").click(function() {
		var player = $("#jplayer-file-"+name),
				self = $(this);
		if(!player.data("jPlayer").status.srcSet) {
			$(this).toggleClass("load fa-spin");
			$.ajax({
				type: 'POST',
				url: "ajax.php",
				data: {module: "recordings", command: "gethtml5", file: name, filenames: $("#file-"+name).data("filenames"), system: $("#file-"+name).data("system"), language: language},
				dataType: 'json',
				timeout: 30000,
				success: function(data) {
					if(data.status) {
						player.on($.jPlayer.event.error, function(event) {
							console.log(event);
						});
						player.jPlayer( "setMedia", data.files)
						player.one($.jPlayer.event.canplay, function(event) {
							player.jPlayer("play");
							self.removeClass("load fa-spin");
						});
						player.on($.jPlayer.event.play, function(event) {
							player.jPlayer("pauseOthers", 0);
							self.data("playing", true);
							self.addClass("active");
						});
						player.on($.jPlayer.event.pause, function(event) {
							self.data("playing", false);
							self.removeClass("active");
						});
						player.on($.jPlayer.event.ended, function(event) {
							self.data("playing", false);
							self.removeClass("active");
						});
					}
				},
				error: function(data) {

				},
			});
		} else {
			if(self.data("playing")) {
				player.jPlayer("pause");
			} else {
				player.jPlayer("play",0);
			}
		}
	});
	checkList();
}

/**
 * Link Formatter for the grid
 * @param  {string} value The value of this cel
 * @param  {object} row   The entire row
 * @param  {int} index Something?
 * @return {string}       Return the resulting html for the cel
 */
function linkFormatter(value, row, index){
	var html = '<a href="?display=recordings&action=edit&id='+row.id+'"><i class="fa fa-pencil"></i></a>';
	html += '&nbsp;<a href="?display=recordings&action=delete&id='+row.id+'" class="delAction"><i class="fa fa-trash"></i></a>';
	return html;
}

/**
 * Turn the file list into an object
 */
function convertList() {
	soundList = {};
	$("#files li").each(function() {
		var name = $(this).data("name");
		soundList[name] = {
			"name": $(this).data("name"),
			"filenames": $(this).data("filenames"),
			"system": $(this).data("system") ? true : false,
			"languages": $(this).data("languages")
		};
	})
}

/**
 * Generate file list for language
 */
function generateList() {
	$.jPlayer.pause();
	$("#playbacks").html("");
	$("#missing-file-alert").addClass("hidden");
	$("#files").html("");
	if(typeof soundList !== "undefined") {
		if(!isObjEmpty(soundList)) {
			$.each(soundList, function(k,v) {
				var exists = (v.languages.indexOf(language) >= 0);
				addFile(v.name, v.filenames, v.languages, exists, v.system);
			});
			$("#file-alert").addClass("hidden");
		} else {
			$("#file-alert").removeClass("hidden");
		}
	} else {
		$("#file-alert").removeClass("hidden");
	}
}

function checkList() {
	var count = 0;
	$("#files li").each(function() {
		count++;
	});
	if(count === 1) {
		$(".fcode-item").prop("disabled", false);
		$("#fcode-message").text($("#fcode-message").data("message"));
	} else {
		$(".fcode-item").prop("disabled", true);
		$("#fcode-message").text(_("Not supported on compounded recordings"));
	}

	if($(".missing").length > 0) {
		$("#missing-file-alert").removeClass("hidden");
	} else {
		$("#missing-file-alert").addClass("hidden");
	}
}

/**
 * Helper function to check if an object is empty
 * @param  {object}  obj The object to check
 * @return {Boolean}     true if empty
 */
function isObjEmpty(obj) {
	for(var key in obj) {
		if(obj.hasOwnProperty(key)) {
			return false;
		}
	}
	return true;
}

/**
 * Helper function to check if the provided file name clashes with
 * another sound file on the system
 * Checks by language, not by format
 * @param  {string} name The file to check
 * @return {bool}      True if it clashes, false if not
 */
function sysRecConflict(name) {
	return (typeof systemRecordings[name] !== "undefined" && typeof systemRecordings[name].languages[language] !== "undefined");
}

/**
 * Helper function to save the Browser Recording
 * @param  {string}   name     The name of the recording
 * @param  {Function} callback Callback when file has been saved
 */
function saveBrowserRecording(name, callback) {
	var data = new FormData();
	data.append("file", soundBlob);
	$.ajax({
		type: "POST",
		url: "ajax.php?module=recordings&command=savebrowserrecording&filename=" + encodeURIComponent(name),
		xhr: function() {
			$("#browser-recorder-progress").removeClass("hidden").addClass("in");
			var xhr = new window.XMLHttpRequest();
			//Upload progress
			xhr.upload.addEventListener("progress", function(evt) {
				if (evt.lengthComputable) {
					var percentComplete = evt.loaded / evt.total,
					progress = Math.round(percentComplete * 100);
					$("#browser-recorder-progress .progress-bar").css("width", progress + "%");
					if(progress == 100) {
						$("#browser-recorder-progress").addClass("hidden").removeClass("in");
						$("#browser-recorder-progress .progress-bar").css("width", "0%");
					}
				}
			}, false);
			return xhr;
		},
		data: data,
		processData: false,
		contentType: false,
		success: function(data) {
			if(data.status) {
				var paths = {};
				paths[language] = data.localfilename;
				addFile(data.filename, paths, [language], true, false);
			}
			if(typeof callback === "function") {
				callback(data);
			}
		},
		error: function() {
		}
	});
}

/**
 * Helper function to save a recording made over an extension
 * @param  {string}   extension The extension number
 * @param  {string}   filename  The temporary filename
 * @param  {string}   name      The user provided name
 * @param  {Function} callback  Callback to be called when completed
 */
function saveExtensionRecording(extension, filename, name, callback) {
	$.post( "ajax.php", {module: "recordings", command: "saverecording", extension: extension, filename: filename, name: name}, function( data ) {
		if(data.status) {
			var paths = {};
			paths[language] = data.localfilename;
			addFile(data.filename, paths, [language], true, false);
		}
		if(typeof callback === "function") {
			callback(data);
		}
	});
}

$(document).on("keyup paste", ".name-check", function(e) {
	if (e.keyCode == 37 || e.keyCode == 38 || e.keyCode == 39 || e.keyCode == 40) {
		return;
	}
	var i = $(this).val().replace(/\s+/g, '-').toLowerCase();
	$(this).val(i);
});
