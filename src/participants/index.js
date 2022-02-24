import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Button,
  Select,
  Tooltip,
  Switch,
  Input,
  List,
  Avatar,
  Icon,
} from "antd";
import { reactLocalStorage } from "reactjs-localstorage";
import MicrophoneIcon from "mdi-react/MicrophoneIcon";
import MicrophoneOffIcon from "mdi-react/MicrophoneOffIcon";

const colors = [
  "#00AA55",
  "#009FD4",
  "#B381B3",
  "#939393",
  "#E3BC00",
  "#D47500",
  "#DC2A2A",
];

function numberFromText(text) {
  // numberFromText("AA");
  const charCodes = text
    .split("") // => ["A", "A"]
    .map((char) => char.charCodeAt(0)) // => [65, 65]
    .join(""); // => "6565"
  return parseInt(charCodes, 10);
}

export default function ParticipantDialog(props) {
  const [visible, setVisible] = useState(false);
  const [members, setMembers] = useState([]);
  let info = reactLocalStorage.getObject("loginInfo");

  const peers = props.peers;
  const showParticipantModal = () => {
    setVisible(true);
  };

  
  useEffect(() => {
    setMembers([
      {
        uid: "123",
        name: info.displayName + "(Me)",
        state: "active",
        audioStatus: props.audioStatus,
      },
      ...props.peers,
    ]);
  }, [props.peers, props.audioStatus]);

  const handleOk = () => {};

  const handleCancel = () => {};
  return (
    <div id="chat-panel" className="chat-panel">
      <div className="title-panel">
        <span className="title-chat">Partcipants Info</span>
      </div>
      <div className="chat-input">
        <List
          itemLayout="horizontal"
          dataSource={members}
          style={{ flex: 1 }}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Avatar
                    style={{
                      backgroundColor:
                        colors[numberFromText(item.name) % colors.length],
                    }}
                  >
                    {item.name[0]}
                  </Avatar>
                }
                title={item.name}
              />
              <div>
                <Tooltip title="Mute/Cancel">
                  <Icon
                    component={
                      item.audioStatus !== false
                        ? MicrophoneIcon
                        : MicrophoneOffIcon
                    }
                    style={{
                      color: item.audioStatus !== false ? "white" : "red",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  />
                </Tooltip>
              </div>
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}
