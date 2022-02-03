import { useEffect } from "react";

export default function OauthLogin(){

    useEffect(() => {
      // for completing the osm authentication & closing the window
      window.opener.authComplete(window.location.href);
      window.close();
    });

    return (
        <h1>Hello Login</h1>
    );
}