# MapScreenShare

MapScreenShare is a WebRTC based  application where multiple users can collaborate in editing a map. The project makes use 

1. [ion](https://github.com/pion/ion)- For WebRTC 
2. [ion-app-web](https://github.com/pion/ion-app-weba) - For Frontend UI
3. [iD](https://github.com/openstreetmap/iD) - For Map Editing
4. [React](https://github.com/facebook/react) - `ion-app-web` is based on react 
5. [Antd](https://ant.design/) - `ion-app-web` uses ant.design for UI


## Production Deployment

1. Deploy `ion` using docker
2. Clone this repository & `cd` to that repository
3. Run `npm install`
4. Make Changes to core iD file at `node_modules/@hotosm/id/dist/iD.js`
    1. Dispatch Storage Change ( Critical for identifying draw changes)
        1. search for `saved_history`
        2. locate the `save` function
        3. add this line `window.dispatchEvent(new Event('storage'))`
    2. Dispatch PopState Event ( Critical for identifying item selection)
        1. search for `window.replaceState`
        2. add this line `window.dispatchEvent(new PopStateEvent('popstate'))`
4. Run `npm run build`
5. Run `cp -r static dist/` (essential for language translations & icons of iD)
6. Run `cp static/land.html dist/` (for login redirect with login with OSM)
8. Prepare Nginx Conf file with Following Section
```
    root /opt/ion-app-web/dist/;
    index index.html index.htm index.nginx-debian.html;

    location /room.RoomSignal/ {
            proxy_pass http://localhost:5551;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
    }

    location /rtc.RTC/ {
            proxy_pass http://localhost:5551;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
    }
```

## Development

1. Change `webpack.config.js` file's `devserver` section.
2. It is right now configured to work on internal ip and
3. Connected to our public instance for testing without deploying ion locally
4. Check `ion-app-web` deployment for customization 


