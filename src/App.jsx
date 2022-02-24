import React, { useEffect, useRef, useState, forwardRef } from "react";
import {
  Layout,
  Button,
  Modal,
  Icon,
  notification,
  Card,
  Spin,
  Tooltip,
  Typography,
} from "antd";

const { Text } = Typography;
const { confirm } = Modal;
const { Header, Content, Footer, Sider } = Layout;
import { reactLocalStorage } from "reactjs-localstorage";
import MicrophoneIcon from "mdi-react/MicrophoneIcon";
import MicrophoneOffIcon from "mdi-react/MicrophoneOffIcon";
import HangupIcon from "mdi-react/PhoneHangupIcon";
import TelevisionIcon from "mdi-react/TelevisionIcon";
import TelevisionOffIcon from "mdi-react/TelevisionOffIcon";
import VideoIcon from "mdi-react/VideoIcon";
import VideocamOffIcon from "mdi-react/VideocamOffIcon";
import MediaSettings from "./settings";
import ToolShare from "./ToolShare";
import ChatFeed from "./chat/index";
import Message from "./chat/message";
import pionLogo from "../public/pion-logo.svg";
import "../styles/css/app.scss";
// ID Integration
import * as iD from "@hotosm/id/dist/iD.js";
import "@hotosm/id/dist/iD.css";
import { useSelector, useDispatch } from "react-redux";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import debounce from "lodash.debounce";
import ParticipantDialog from "./participants";
// End Integration

import LoginForm from "./LoginForm";
import Conference from "./Conference";
import * as Ion from "ion-sdk-js/lib/connector";
import { v4 as uuidv4 } from "uuid";

const ForwardRefConference = forwardRef(Conference);

function useStateRef(initialValue) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return [value, setValue, ref];
}

function App(props) {
  const conference = useRef(null);

  const [login, setLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [screenSharingEnabled, setScreenSharingEnabled] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [vidFit, setVidFit] = useState(false);
  const [loginInfo, setLoginInfo] = useState({});
  const [messages, setMessages] = useState([]);
  const [sid, setSid] = useState("");
  const [uid, setUid] = useState(uuidv4());
  const [peers, setPeers] = useState([]);
  const [connector, setConnector] = useState(null);
  const [room, setRoom] = useState(null);
  const [rtc, setRTC] = useState(null);
  const [name, setname] = useState("");

  //ID Integration
  const sync = useRef(false);
  const iDContext = useSelector((state) => state.editor.context);
  // TODO: Set Default Location To Kerala With a Higher Zoom Level
  const [mapObj, setMapObj] = useState({
    zoom: 4,
    center: [21.82, 71.81],
  });
  const windowInit = typeof window !== undefined;
  const [background, setBackground] = useState(
    localStorage.getItem("background-last-used") || "Bing"
  );
  const dispatch = useDispatch();

  //End Integration

  let settings = {
    selectedAudioDevice: "",
    selectedVideoDevice: "",
    resolution: "vga",
    bandwidth: 512,
    codec: "vp8",
    isDevMode: false,
  };

  useEffect(() => {
    let _settings = reactLocalStorage.getObject("settings");
    if (_settings.codec !== undefined) {
      settings = _settings;
    }
    return () => {
      cleanUp();
    };
  }, []);

  const cleanUp = async () => {
    await conference.current.cleanUp();
    window.location.reload();
  };
  // ID Integration
  useEffect(() => {
    if (windowInit) {
      if (iDContext === null) {
        // we need to keep iD context on redux store because iD works better if
        // the context is not restarted while running in the same browser session
        dispatch({ type: "SET_EDITOR", context: window.iD.coreContext() });
      }
    }
  }, [windowInit, iDContext, dispatch]);

  useEffect(() => {
    if (iD && iDContext && login) {
      // if presets is not a populated list we need to set it as null

      // window.iD.presetManager.addablePresetIDs(null);
      // setup the context
      iDContext
        .embed(true)
        .assetPath("/static/")
        .locale("en")
        .setsDocumentTitle(false)
        .containerNode(document.getElementById("id-container"));

      // init the ui or restart if it was loaded previously

      if (iDContext.ui() !== undefined) {
        iDContext.reset();
        iDContext.ui().restart();
      } else {
        iDContext.init();
      }

      async function sentSyncRequest() {
        // Initial Background Layer Synchronization is not possible
        // unless all imageries are loaded which is async. Hence this code
        await iDContext.background().ensureLoaded();
        if (!sync.current) {
          //send sync request;
          let data = {
            uid: uid,
            name: "sync-message",
          };
          sentMessage(room, data, 'sync-request');
        }
      }

      sentSyncRequest();

      /**
       * Listening to the localstorage change is the key
       * of replicating drawing changes to remote
       * Event is manually dispatched from the core iD Code
       */

      window.addEventListener("storage", () => {
        let history = localStorage.getItem(
          `iD_${window.location.origin}_saved_history`
        );

        // Prevent triggering while drawing a line or area
        if (
          iDContext.mode().id !== "draw-line" &&
          iDContext.mode().id !== "draw-area"
        ) {
          let selectedIDs = iDContext.selectedIDs();
          let data = {
            uid: uid,
            name: "sync-message",
            text: [
              history,
              iDContext.map().zoom(),
              iDContext.map().center(),
              selectedIDs,
            ],
          };
          sentMessage(room, data, "drawchange");
        }
      });

      // Button Click Handling
      // TODO: Better mode change detection should be identified
      document.addEventListener("click", handleButtonClick);

      // listens for window.history.replaceState call in the iD Core Code
      // Event is manually dispatched from the core iD Code
      // Responsible for replicating selection of items on the map
      window.onpopstate = checkElementSelected;
    }
  }, [iDContext, login]);

  const sentMessage = (room, data, action) => {
    if (room) {
      //console.log('entering', action, room, data);
      let info = reactLocalStorage.getObject("loginInfo");
      let map = new Map();
      map.set("msg", data);
      room.message(info.roomId, action, "all", "Map", map);
    }
  };

  const checkElementSelected = () => {
    let hash = window.location.hash.substring(1);
    let params = {};

    hash.split("&").map((hk) => {
      let temp = hk.split("=");
      params[temp[0]] = temp[1];
    });

    // if id is present in the hash , it means one item is selected
    if (params.id && sync.current === true) {
      let selectedIDs = iDContext.selectedIDs();
      let mode = iDContext.mode().id;
      var data = {
        uid: uid,
        name: "sync-message",
        text: [selectedIDs, mode],
      };

      sentMessage(room, data, "select-change");
    }
  };

  const handleButtonClick = (event) => {
    let element = event.target;

    // Many times click will be triggered on inner button elements
    // Hence the parent traversal
    let parent = event.target.closest("button");
    if (
      (element &&
        element.tagName === "BUTTON" &&
        element.classList.contains("add-button")) ||
      (parent &&
        parent.tagName === "BUTTON" &&
        parent.classList.contains("add-button"))
    ) {
      let data = {
        uid: uid,
        name: "sync-message",
        text: [
          element.tagName === "BUTTON"
            ? element["__data__"]["id"]
            : parent["__data__"]["id"],
        ],
      };

      sentMessage(room, data, "mode-change");
    }
  };

  /**
   * Layer Change Detection
   * Which is also identified during a change
   * in hash occurs
   */
  const checkBackgroundChange = () => {
    let hash = window.location.hash.substring(1);
    let params = {};
    hash.split("&").map((hk) => {
      let temp = hk.split("=");
      params[temp[0]] = temp[1];
    });
    if (params.background && sync.current === true) {
      // setBackground inturn triggers the message to remote
      setBackground(params.background);
    }
  };

  /**
   * Map Movement Detection
   * Debounce is used to prevent triggering immediate map movements
   */
  const mapMoveHandler = debounce(() => {
    if (sync.current) {
      let info = reactLocalStorage.getObject("loginInfo");
      let mapCenter = iDContext.map().center();
      let mapZoom = iDContext.map().zoom();
      if (
        mapObj["center"][0] !== mapCenter[0] ||
        mapObj["center"][1] !== mapCenter[1] ||
        mapObj["zoom"] !== mapZoom
      ) {
        var data = {
          uid: uid,
          name: loginInfo.displayName,
          text: [iDContext.map().zoom(), iDContext.map().center()],
        };

        sentMessage(room, data, "hashchange");
      }
    }
  }, 500);

  /**
   * Triggers when background layer is changed
   * @param {*} bg 
   */
  const changeBackground = (bg) => {
    // change background for sync is called before useeffect
    if (bg) {
      let d = iDContext.background().findSource(bg);
      if (d && d.id) {
        let previousBackground = iDContext.background().baseLayerSource();
        localStorage.setItem(
          "background-last-used-toggle",
          previousBackground.id
        );
        localStorage.setItem("background-last-used", d.id);
        iDContext.background().baseLayerSource(d);
      }
    }
  };

  // updating the map when mapObj changes
  useEffect(() => {
    if (iDContext) {
      iDContext.map().zoom(mapObj["zoom"]);
      iDContext.map().center(mapObj["center"]);
      iDContext.map().on("move", mapMoveHandler);
      return () => {
        iDContext.map().on("move", null);
      };
    }
  }, [mapObj]);

  // when background is set , triggers bgchange event in the remote
  useEffect(() => {
    if (room && sync.current !== null) {
      let data = {
        uid: uid,
        name: "sync-message",
        text: [background],
      };
      sentMessage(room, data, "bgChange");
    }

    // essential for the listeners to remain uptodate
    // else state variables inside lister functions will use
    // the value at the time of registering the event
    window.addEventListener("hashchange", checkBackgroundChange);
    return () => {
      window.removeEventListener("hashchange", checkBackgroundChange);
    };
  }, [background]);

  useEffect(() => {
    if (room && sync.current !== null) {
      room.onpeerevent = handlePeerEvent;
      return () => {
        room.onpeerevent = null;
      };
    }
  }, [peers]);
  // End Integration
  const notificationTip = (message, description) => {
    notification.info({
      message: message,
      description: description,
      placement: "bottomRight",
    });
  };

  const handlePeerEvent = (ev) => {
    if (ev.state == Ion.PeerState.JOIN) {
      notificationTip(
        "Peer Join",
        "peer => " + ev.peer.displayname + ", join!"
      );
      onSystemMessage(ev.peer.displayname + ", join!");
    } else if (ev.state == Ion.PeerState.LEAVE) {
      notificationTip(
        "Peer Leave",
        "peer => " + ev.peer.displayname + ", leave!"
      );
      onSystemMessage(ev.peer.displayname + ", leave!");
    }

    let peerInfo = {
      uid: ev.peer.uid,
      name: ev.peer.displayname,
      state: ev.state,
    };
    let _peers = peers;
    let find = false;

    _peers.forEach((item) => {
      if (item.uid == ev.peer.uid) {
        item = peerInfo;
        find = true;
      }
    });
    if (!find) {
      _peers.push(peerInfo);
    }
    //ID Integration
    // Update the peer when someone left the room
    else {
      _peers = _peers.filter((item) => item.uid !== ev.peer.uid);
    }
    // end integration
    setPeers([..._peers]);
  };

  const handleJoin = async (values) => {
    sync.current = null;
    setLoading(true);
    // open chat window
    // openOrCloseLeftContainer(!collapsed);
    let url =
      window.location.protocol +
      "//" +
      window.location.hostname +
      //":" + "5551";
      // Note if you're running this inside docker you'll need to remove the ":5551" and possibly add the following line so that caddy can proxy correctly
      ":" +
      window.location.port;
    let connector = new Ion.Connector(url, "token");
    setConnector(connector);

    let room = new Ion.Room(connector);
    let rtc = new Ion.RTC(connector);
    setRoom(room);
    setRTC(rtc);

    room.onjoin = (success, reason) => {
      onJoin(values, sid, uid);
    };

    room.onleave = (reason) => {};

    room.onpeerevent = handlePeerEvent;

    room.onmessage = (msg) => {
      const uint8Arr = new Uint8Array(msg.data);
      const decodedString = String.fromCharCode.apply(null, uint8Arr);
      const json = JSON.parse(decodedString);
      let _messages = messages;
      let data = json.msg.text;
      let m_uid = json.msg.uid;

      //ID Integration

      switch (msg.from) {
        case "sync-request":
          if (sync.current) {
            let response_data = {
              uid: uid,
              name: loginInfo.displayName,
              text: [
                json.msg.uid,
                iDContext.map().zoom(),
                iDContext.map().center(),
                iDContext.background().baseLayerSource().id,
              ],
            };
            sentMessage(room, response_data, "sync-response");
          }
          break;
        case "sync-response":
          if (!sync.current && uid === data[0]) {
            setMapObj({
              zoom: data[1],
              center: data[2],
            });
            setBackground(data[3]);
            changeBackground(data[3]);
            sync.current = true;
          }
          break;
        case "hashchange":
          let mapCenter = iDContext.map().center();
          let mapZoom = iDContext.map().zoom();
          if (
            m_uid !== uid &&
            mapCenter[0] !== mapObj["center"][0] &&
            mapCenter[1] !== mapObj["center"][1] &&
            mapZoom !== mapObj["zoom"]
          ) {
            setMapObj({
              zoom: data[0],
              center: data[1],
            });
          }
          break;
        case "drawchange":
          if (m_uid !== uid) {
            let iDs = iDContext.selectedIDs();
            if (!data[0] || data[0] === null) {
              if (iDs && iDs.length > 0) {
                // last change deleted which needs to reflect here
                window.iD.operationDelete(iDContext, iDs)();
                // iDContext.flush();
              }
              localStorage.removeItem(
                `iD_${window.location.origin}_saved_history`
              );
              iDContext.history().restore();
              iDContext.enter(window.iD.modeBrowse(iDContext));
            } else {
              localStorage.setItem(
                `iD_${window.location.origin}_saved_history`,
                data[0]
              );
              setMapObj({
                zoom: data[1],
                center: data[2],
              });
              if (data[3]) {
                iDContext.history().restore();
                iDContext.enter(
                  window.iD.modeSelect(iDContext, data[3]).newFeature(true)
                );
              }
            }
          }

          break;
        case "bgChange":
          if (m_uid !== uid || sync.current === false) {
            changeBackground(data[0]);
          }
          break;
        case "audio-change":
          if (uid !== m_uid) {
            updatePeer(m_uid, data[0]);
          }
          break;
        case "mode-change":
          if (m_uid !== uid && sync.current) {
            document
              .querySelector("." + data[0])
              .dispatchEvent(new Event("click"));
          }
          break;
        case "select-change":
          if (m_uid !== uid && sync.current) {
            if (data[1] === "select") {
              iDContext.enter(window.iD.modeSelect(iDContext, data[0]));
            }
          }
          break;
      }
      //End Integration
      if (uid != msg.from) {
        let _uid = 1;

        _messages.push(
          new Message({
            id: _uid,
            message: json.msg.text,
            senderName: json.msg.name,
          })
        );
        setMessages([..._messages]);
      }
    };

    room
      .join(
        {
          sid: values.roomId,
          uid: uid,
          displayname: values.displayName,
          extrainfo: "",
          destination: "webrtc://ion/peer1",
          role: Ion.Role.HOST,
          protocol: Ion.Protocol.WEBRTC,
          avatar: "string",
          direction: Ion.Direction.INCOMING,
          vendor: "string",
        },
        ""
      )
      .then((result) => {
        // console.log(
        //   "[join] result: success " +
        //     result?.success +
        //     ", room info: " +
        //     JSON.stringify(result?.room)
        // );

        if (!result?.success) {
          // console.log("[join] failed: " + result?.reason);
          return;
        }

        rtc.ontrackevent = function (ev) {
          // console.log(
          //   "[ontrackevent]: \nuid = ",
          //   ev.uid,
          //   " \nstate = ",
          //   ev.state,
          //   ", \ntracks = ",
          //   JSON.stringify(ev.tracks)
          // );
          let _peers = peers;
          _peers.forEach((item) => {
            ev.tracks.forEach((track) => {
              // if (item.uid == ev.uid && track.kind == "video") {
              if (item.uid == ev.uid && track.kind == "audio") {
                // console.log("track=", track);
                // item["id"] = JSON.stringify(ev.tracks)[0].id;
                item["id"] = track.stream_id;
                // console.log("ev.streams[0].id:::" + item["id"]);
              }
            });
          });

          setPeers([..._peers]);
        };

        rtc.ondatachannel = ({ channel }) => {
          //console.log("[ondatachannel] channel=", channel);
          channel.onmessage = ({ data }) => {
            //console.log("[ondatachannel] channel onmessage =", data);
          };
        };

        rtc.join(values.roomId, uid);
        //console.log("rtc.join");
      });

    window.onunload = async () => {
      await cleanUp();
    };
  };


  const onJoin = async (values, sid, uid) => {
    reactLocalStorage.remove("loginInfo");
    reactLocalStorage.setObject("loginInfo", values);

    setLogin(true);
    setLoading(false);
    setSid(sid);
    setUid(uid);
    setLoginInfo(values);

    //setLocalVideoEnabled(!values.audioOnly);
    setLocalVideoEnabled(false);
    // commmented for id integration
    conference.current.handleLocalStream(true);

    notificationTip(
      "Connected!",
      "Welcome to the ion room => " + values.roomId
    );

    // ID Integration

    // not ideal
    // but gives higher preference to one who joined first
    // the code is for syncing the initial state of the beginner to all others
    // and preventing the reverse.

    setTimeout(() => {
      if (peers.length === 0 && !sync.current) {
        sync.current = true;
        console.log("synced");
      }
    }, 2000);

    // End Integraion
  };

  //ID Integration
  const updatePeer = (uid, status) => {
    let _peers = peers;
    let index = _peers.findIndex((item) => item.uid === uid);
    if (index !== -1) {
      let peerInfo = _peers[index];
      peerInfo.audioStatus = status;
      _peers.splice(index, 1);
      _peers.push(peerInfo);
      setPeers([..._peers]);
    }
  };

  // End Integration

  const handleLeave = async () => {
    confirm({
      title: "Leave Now?",
      content: "Do you want to leave the room?",
      async onOk() {
        await cleanUp();
        setLogin(false);
      },
      onCancel() {
        console.log("Cancel");
      },
    });
  };

  const handleAudioTrackEnabled = (enabled) => {
    setLocalAudioEnabled(enabled);
    conference.current.muteMediaTrack("audio", enabled);

    // ID Integration
    var data = {
      uid: uid,
      name: loginInfo.displayName,
      text: [enabled],
    };
    sentMessage(room, data, "audio-change");
    // End Integration
  };

  const handleVideoTrackEnabled = (enabled) => {
    setLocalVideoEnabled(enabled);
    conference.current.muteMediaTrack("video", enabled);
  };

  const handleScreenSharing = (enabled) => {
    setScreenSharingEnabled(enabled);
    conference.current.handleScreenSharing(enabled);
  };

  const openOrCloseLeftContainer = (collapsed) => {
    setCollapsed(collapsed);
  };

  const onVidFitClickHandler = () => {
    setVidFit(!vidFit);
  };

  const onFullScreenClickHandler = () => {
    let docElm = document.documentElement;

    if (fullscreenState()) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }

      setIsFullScreen(false);
    } else {
      if (docElm.requestFullscreen) {
        docElm.requestFullscreen();
      }
      //FireFox
      else if (docElm.mozRequestFullScreen) {
        docElm.mozRequestFullScreen();
      }
      //Chrome
      else if (docElm.webkitRequestFullScreen) {
        docElm.webkitRequestFullScreen();
      }
      //IE11
      else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
      setIsFullScreen(true);
    }
  };

  const fullscreenState = () => {
    return (
      document.fullscreen ||
      document.webkitIsFullScreen ||
      document.mozFullScreen ||
      false
    );
  };

  const onMediaSettingsChanged = (
    selectedAudioDevice,
    selectedVideoDevice,
    resolution,
    bandwidth,
    codec,
    isDevMode
  ) => {
    settings = {
      selectedAudioDevice,
      selectedVideoDevice,
      resolution,
      bandwidth,
      codec,
      isDevMode,
    };
    reactLocalStorage.setObject("settings", this._settings);
  };

  const onSendMessage = (msg) => {
    let info = reactLocalStorage.getObject("loginInfo");
    console.log("broadcast to room: ", info.roomId, " message: " + msg);

    var data = {
      uid: uid,
      name: loginInfo.displayName,
      text: msg,
    };
    let map = new Map();
    map.set("msg", data);
    room.message(info.roomId, uid, "all", "Map", map);
    let _messages = messages;
    let _uid = 0;
    _messages.push(new Message({ id: _uid, message: msg, senderName: "me" }));
    setMessages([..._messages]);
  };

  const onSystemMessage = (msg) => {
    let _messages = messages;
    let _uid = 2;
    _messages.push(
      new Message({ id: _uid, message: msg, senderName: "System" })
    );
    setMessages([..._messages]);
  };

  const onScreenSharingClick = (enabled) => {
    setScreenSharingEnabled(enabled);
  };

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="app-header-left">
          <a href="https://mss.cfc.net.in" target="_blank">
            {/* <img src={pionLogo} className="app-logo-img" /> */}
            <Text type="danger" style={{ fontSize: "2em" }}>
              MapScreenShare
            </Text>
          </a>
        </div>
        {login ? (
          <div className="app-header-tool">
            <Tooltip title="Mute/Cancel">
              <Button
                ghost
                size="large"
                style={{ color: localAudioEnabled ? "" : "red" }}
                type="link"
                onClick={() => handleAudioTrackEnabled(!localAudioEnabled)}
              >
                <Icon
                  component={
                    localAudioEnabled ? MicrophoneIcon : MicrophoneOffIcon
                  }
                  style={{ display: "flex", justifyContent: "center" }}
                />
              </Button>
            </Tooltip>

            {/* <Tooltip title="Open/Close video">
              <Button
                ghost
                size="large"
                style={{ color: localVideoEnabled ? "" : "red" }}
                type="link"
                onClick={() => handleVideoTrackEnabled(!localVideoEnabled)}
              >
                <Icon
                  component={localVideoEnabled ? VideoIcon : VideocamOffIcon}
                  style={{ display: "flex", justifyContent: "center" }}
                />
              </Button>
            </Tooltip> */}
            <Tooltip title="Hangup">
              <Button
                shape="circle"
                ghost
                size="large"
                type="danger"
                style={{ marginLeft: 16, marginRight: 16 }}
                onClick={handleLeave}
              >
                <Icon
                  component={HangupIcon}
                  style={{ display: "flex", justifyContent: "center" }}
                />
              </Button>
            </Tooltip>
            {/* <Tooltip title="Share desktop">
              <Button
                ghost
                size="large"
                type="link"
                style={{ color: screenSharingEnabled ? "red" : "" }}
                onClick={() => handleScreenSharing(!screenSharingEnabled)}
              >
                <Icon
                  component={
                    screenSharingEnabled ? TelevisionOffIcon : TelevisionIcon
                  }
                  style={{ display: "flex", justifyContent: "center" }}
                />
              </Button>
            </Tooltip> */}
            <ToolShare loginInfo={loginInfo} />
          </div>
        ) : (
          <div />
        )}
        <div className="app-header-right">
          {/* <MediaSettings
            onMediaSettingsChanged={onMediaSettingsChanged}
            settings={settings}
          /> */}
        </div>
      </Header>

      <Content className="app-center-layout">
        {login ? (
          <Layout className="app-content-layout">
            <Sider
              width={320}
              style={{ background: "#333" }}
              collapsedWidth={0}
              trigger={null}
              collapsible
              collapsed={collapsed}
            >
              <div className="left-container">
                <ParticipantDialog
                  loginInfo={loginInfo}
                  peers={peers}
                  audioStatus={localAudioEnabled}
                />
                {/* <ChatFeed messages={messages} onSendMessage={onSendMessage} /> */}
              </div>
            </Sider>
            <Layout className="app-right-layout">
              <Content style={{ flex: 1 }}>
                <ForwardRefConference
                  uid={uid}
                  sid={sid}
                  collapsed={collapsed}
                  connector={connector}
                  room={room}
                  rtc={rtc}
                  settings={settings}
                  peers={peers}
                  localAudioEnabled={localAudioEnabled}
                  localVideoEnabled={localVideoEnabled}
                  screenSharingClick={onScreenSharingClick}
                  vidFit={vidFit}
                  ref={conference}
                />
                {/* iDContainer */}
                <div className="w-100 vh-minus-77-ns" id="id-container"></div>
              </Content>
              <div className="app-collapsed-button">
                <Tooltip title="Open/Close chat panel">
                  <Button
                    icon={collapsed ? "right" : "left"}
                    size="large"
                    shape="circle"
                    ghost
                    onClick={() => openOrCloseLeftContainer(!collapsed)}
                  />
                </Tooltip>
              </div>
              {/* <div className="app-fullscreen-layout">
                <Tooltip title="Fit/Stretch Video">
                  <Button
                    icon={vidFit ? "minus-square" : "plus-square"}
                    size="large"
                    shape="circle"
                    ghost
                    onClick={() => onVidFitClickHandler()}
                  />
                </Tooltip>
                <Tooltip title="Fullscreen/Exit">
                  <Button
                    icon={isFullScreen ? "fullscreen-exit" : "fullscreen"}
                    size="large"
                    shape="circle"
                    className="app-fullscreen-button"
                    ghost
                    onClick={() => onFullScreenClickHandler()}
                  />
                </Tooltip>
              </div> */}
            </Layout>
          </Layout>
        ) : loading ? (
          <Spin size="large" tip="Connecting..." />
        ) : (
          <Card title="Join to MapScreenShare" className="app-login-card">
            <LoginForm handleLogin={handleJoin} />
          </Card>
        )}
      </Content>

      {!login && (
        <Footer className=".app-footer">
          Powered by{" "}
          <a href="https://mss.cfc.net.in" target="_blank">
            CFC
          </a>{" "}
          WebRTC.
        </Footer>
      )}
    </Layout>
  );
}

export default App;
