export class FaceVideo {
  constructor({
    width = 512,
    height = 512,
    mini,
    videoEl,
    onChangeDeviceName = () => {},
    onChangeDeviceStore = () => {},
  }) {
    this.width = width;
    this.height = height;

    this.onChangeDeviceStore = onChangeDeviceStore;
    this.onChangeDeviceName = onChangeDeviceName;

    this._deviceName = "";
    this._devicesStore = {
      audioinput: [],
      audiooutput: [],
      videoinput: [],
    };

    this.videoEl = videoEl || document.createElement("video");

    this.videoEl.playsinline = true;
    this.videoEl.autoplay = true;
    this.videoEl.setAttribute("playsinline", true);
    this.videoEl.style.position = "absolute";
    this.videoEl.style.top = "0px";
    this.videoEl.style.left = "0px";
    this.videoEl.style.pointerEvents = "none";
    this.videoEl.style.opacity = "0.0";
    this.videoEl.style.zIndex = -1;

    document.body.appendChild(this.videoEl);
    mini.onClean(() => {
      document.body.removeChild(this.videoEl);
      this.videoEl.remove();
    });

    this.listOutDevices = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();

      for (const device of devices) {
        let name;
        switch (device.kind) {
          case "audioinput":
            name = device.label || "Microphone";
            break;
          case "audiooutput":
            name = device.label || "Speakers";
            break;
          case "videoinput":
            name = device.label || "Camera";
            break;
        }
        this.devicesStore[device.kind].push(device);
      }

      return this.devicesStore;
    };

    this.getMediaByDevice = async ({ device }) => {
      return new Promise(async (resolve) => {
        let videoEl = this.videoEl;

        const constraints = {
          video: {
            deviceId: device.deviceId,
            width: this.width,
            height: this.height,
          },
        };
        this.deviceName = "Connecting...";
        let stream = null;

        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          this.deviceName = device.label;

          if (videoEl && videoEl.srcObject) {
            videoEl.srcObject.getTracks().forEach((track) => {
              track.stop();
            });
          }

          videoEl.srcObject = stream;
        } catch (err) {
          this.deviceName = `${err.name} ${err.message}`;
          console.log(err.name, err.message);
        }

        videoEl.addEventListener("loadeddata", () => {
          resolve();
        });
      });
    };
  }
  set deviceName(v) {
    this._deviceName = v;

    this.onChangeDeviceName();
  }
  get deviceName() {
    return this._deviceName;
  }

  //
  set devicesStore(v) {
    this._devicesStore = v;

    this.onChangeDeviceStore();
  }
  get devicesStore() {
    return this._devicesStore;
  }
}
