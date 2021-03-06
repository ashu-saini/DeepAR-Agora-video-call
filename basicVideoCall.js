
/*
 *  These procedures use Agora Video Call SDK for Web to enable local and remote
 *  users to join and leave a Video Call channel managed by Agora Platform.
 */

/*
 *  Create an {@link https://docs.agora.io/en/Video/API%20Reference/web_ng/interfaces/iagorartcclient.html|AgoraRTCClient} instance.
 *
 * @param {string} mode - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/clientconfig.html#mode| streaming algorithm} used by Agora SDK.
 * @param  {string} codec - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/clientconfig.html#codec| client codec} used by the browser.
 */
var client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
var deepAR = null;

/*
 * Clear the video and audio tracks used by `client` on initiation.
 */
var localTracks = {
  videoTrack: null,
  audioTrack: null
};

/*
 * On initiation no users are connected.
 */
var remoteUsers = {};

/*
 * On initiation. `client` is not attached to any project or channel for any specific user.
 */
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

var backgrounds = [
  {
    name: 'BG Blur',
    value: 'bg_blur'
  },
  {
    name: 'Livingroom',
    value: 'livingroom'
  },
  {
    name: 'Office',
    value: 'office'
  },
  {
    name: 'Plastic Ocean',
    value: 'plastic_ocean'
  },
  {
    name: 'Beach1',
    value: 'beach1'
  },
  {
    name: 'Beach2',
    value: 'beach2'
  },
  {
    name: 'Beach3',
    value: 'beach3'
  },
  {
    name: 'BG Green',
    value: 'bg_green'
  },
  {
    name: 'BG Yello',
    value: 'bg_yellow'
  },
  {
    name: 'BG Pink',
    value: 'bg_pink'
  },
  {
    name: 'BG White',
    value: 'bg_white'
  },

];

var effects = [
  {
    name: 'Koala',
    value: 'koala'
  },
  {
    name: 'Aviators',
    value: 'aviators'
  },
  {
    name: 'Beard',
    value: 'beard'
  },
  {
    name: 'Beauty',
    value: 'beauty'
  },
  {
    name: 'Dalmatian',
    value: 'dalmatian'
  },
  {
    name: 'Flowers',
    value: 'flowers'
  },
  {
    name: 'Hair Effect',
    value: 'hair_effect'
  },
  {
    name: 'Lion',
    value: 'lion'
  },
  {
    name: 'Pumpkin',
    value: 'pumpkin'
  },
  {
    name: 'Teddycigar',
    value: 'teddycigar'
  }
];

var currentEffect = null;
var isJoined = false;

/*
 * When this page is called with parameters in the URL, this procedure
 * attempts to join a Video Call channel using those parameters.
 */
$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  options.uid = urlParams.get("uid");
  if (options.appid && options.channel) {
    $("#uid").val(options.uid);
    $("#appid").val(options.appid);
    $("#token").val(options.token);
    $("#channel").val(options.channel);
    $("#join-form").submit();
  }
});

$(document).ready(function() {
	var canvasHeight = 320;
  var canvasWidth = 480;
  deepAR = DeepAR({ 
    canvasWidth: canvasWidth, 
    canvasHeight: canvasHeight,
    licenseKey: 'your_license_key_goes_here',
    canvas: document.getElementById('deepar-canvas'),
    numberOfFaces: 1,
    libPath: './lib',
    segmentationInfoZip: 'segmentation.zip',
    onInitialize: function() {
      // start video immediately after the initalization, mirror = true
    }
  });
  deepAR.downloadFaceTrackingModel('lib/models-68-extreme.bin');

  //append background list to backgrounds section
  let blist = "" 
  for(i = 0; i < backgrounds.length; i++) {
    blist = blist + `<li onclick="changeEffect('${backgrounds[i].value}')">${backgrounds[i].name}</li>`
  }
  $("#background-list").append(blist);

  // append effects list to effects section
  let elist = "" 
  for(i = 0; i < effects.length; i++) {
    elist = elist + `<li onclick="changeEffect('${effects[i].value}')">${effects[i].name}</li>`
  }
  $("#effect-list").append(elist);

  $("#background-list li").click(function() {
    $(this).addClass('active').siblings().removeClass('active');
    $("#effect-list").children().removeClass('active');
  });

  $("#effect-list li").click(function() {
    $(this).addClass('active').siblings().removeClass('active');
    $("#background-list").children().removeClass('active');
  });
})

/*
 * When a user clicks Join or Leave in the HTML form, this procedure gathers the information
 * entered in the form and calls join asynchronously. The UI is updated to match the options entered
 * by the user.
 */
$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  try {
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    options.channel = $("#channel").val();
    options.uid = $("#uid").val();
    await join();
    if(options.token) {
      $("#success-alert-with-token").css("display", "block");
    } else {
      $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
      $("#success-alert").css("display", "block");
    }
  } catch (error) {
    console.error(error);
  } finally {
    $("#leave").attr("disabled", false);
  }
})

/*
 * Called when a user clicks Leave in order to exit a channel.
 */
$("#leave").click(function (e) {
  leave();
})

/*
 * Join a channel, then create local video and audio tracks and publish them to the channel.
 */
async function join() {
  loadStream();
	//load AR effect
  if(currentEffect) {
    deepAR.switchEffect(0, 'slot', `./effects/${currentEffect}`, function() {
      // effect loaded
    });
  }

  // deepAR.changeParameterTexture('Background', 'MeshRenderer', 's_texColor', './effects/diffuse10.png');
  // Add an event listener to play remote tracks when remote user publishes.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // Join a channel and create local tracks. Best practice is to use Promise.all and run them concurrently.
  [ options.uid, localTracks.audioTrack ] = await Promise.all([
    // Join the channel.
    client.join(options.appid, options.channel, options.token || null, options.uid || null),
    // Create tracks to the local microphone and camera.
    AgoraRTC.createMicrophoneAudioTrack(),
  ]);

  localTracks.videoTrack = await AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: document.getElementById('deepar-canvas').captureStream().getVideoTracks()[0] })

  // Play the local video track to the local browser and update the UI with the user ID.
  localTracks.videoTrack.play("local-player");
  $("#local-player-name").text(`localVideo(${options.uid})`);

  // Publish the local video and audio tracks to the channel.
  await client.publish(Object.values(localTracks));
  isJoined = true;
  console.log("publish success");
}

async function loadStream() {
  const videoElement = document.getElementById('my-video');
  const devices = await navigator.mediaDevices.enumerateDevices()
  const videoDevice = devices.find(device => device.kind === 'videoinput')
  if (!videoDevice) {
    throw new Error('Could not get video device')
  }

  console.log('initMediaStream')
  videoElement.srcObject = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: videoDevice.deviceId,
      frameRate: 30,
      width: { ideal: 480 },
      height: { ideal: 320 }
    }
  })

  const playPromise = new Promise((resolve) => {
    videoElement.addEventListener('play', () => {
      console.log('playing local video now')
      resolve()
    })
  })
  const loadeddataPromise = new Promise((resolve) => {
    videoElement.addEventListener('loadeddata', () => {
      console.log('local video loadeddata')
      resolve()
    })
  })

  videoElement.play();
  // set video elemet to DeepAR
  deepAR.setVideoElement(videoElement, true);
}

/*
 * Stop all local and remote tracks then leave the channel.
 */
async function leave() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if(track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
    const videoElement = document.getElementById('my-video');
    // stop custom tracks
    (videoElement.srcObject).getTracks().forEach(track => track.stop());
  }

  // Remove remote users and player views.
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();

  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  console.log("client leaves channel success");

  isJoined = false;
}


/*
 * Add the local use to a remote channel.
 *
 * @param  {IAgoraRTCRemoteUser} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to add.
 * @param {trackMediaType - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/itrack.html#trackmediatype | media type} to add.
 */
async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
}

/*
 * Add a user who has subscribed to the live channel to the local interface.
 *
 * @param  {IAgoraRTCRemoteUser} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to add.
 * @param {trackMediaType - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/itrack.html#trackmediatype | media type} to add.
 */
function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

/*
 * Remove the user specified from the channel in the local interface.
 *
 * @param  {string} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to remove.
 */
function handleUserUnpublished(user) {
  const id = user.uid;
  delete remoteUsers[id];
  $(`#player-wrapper-${id}`).remove();
}

function changeEffect(effectname) {
  currentEffect = effectname;
  deepAR.switchEffect(0, 'slot',  `./effects/${effectname}`, function() {
    // effect loaded
  });
}

async function openModal() {
  if(!isJoined) {
    loadStream();
  }
  $('#effectModal').modal('show');
}

function closeModal() {
  if(!isJoined) {
    const videoElement = document.getElementById('my-video');
    // stop custom tracks
    (videoElement.srcObject).getTracks().forEach(track => track.stop());
  }
  $('#effectModal').modal('hide');
}
