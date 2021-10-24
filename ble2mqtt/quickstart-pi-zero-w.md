# Raspberry Pi Zero W

This page will guide you through setting up a Pi Zero W to run ble2mqtt.

## Requirements

### Hardware

- Raspberry Pi Zero W + Power Supply
- Micro SD Card (ideally Application Class 1)
- SD Card reader

### Software

- [balenaEtcher](https://www.balena.io/etcher/)
- Download of the latest [Raspberry Pi OS Lite image](https://www.raspberrypi.org/software/operating-systems/)

## Installing Raspbian

1. Put your microSD card into your card reader.

2. Open balenaEtcher, select the Raspbian image you downloaded and flash it to the SD card.

3. After that is done, create an empty file called `ssh` on the `boot` partition of the SD card that you should now see in your file explorer. You may have to eject your SD card and put it back again before it becomes visible.

4. *Optional:* If you want to use the Pi Zero W with WiFi, you also need to configure the credentials. Create a file called `wpa_supplicant.conf` on the `boot` partition and fill it as shown below, with the marked variables replaced. A list of country codes is available on [Wikipedia](https://en.wikipedia.org/wiki/ISO_3166-1).

   ```
   ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
   update_config=1
   country=<Insert country code here>
   
   network={
    ssid="<Name of your WiFi>"
    psk="<Password for your WiFi>"
   }
   ```

5. Unmount the SD card and remove it from your card reader.

6. Insert the SD card into your Raspberry Pi Zero W, then connect the power supply. Wait a minute for it to boot and connect to your network.

7. Open a SSH shell to `raspberrypi` with the default user `pi` and password `raspberry`. On Windows you can use [Putty](https://www.putty.org), with Linux and macOS you can just open the terminal and type `ssh pi@raspberrypi.local`. If the hostname is not found, use the IP of the Pi instead - it can be found in your router administration panel.

8. Type `passwd` to change your password to something more secure.

9. Type `sudo raspi-config`, use the arrow keys to go to `System Options` and hit Enter, then select `Hostname`, then hit Enter again at the warning about valid characters. Set the hostname to something recognizable, like `bedroom` and hit the Tab key to select the `OK` button and hit Enter to "click" it. After that use the arrow keys to select `Finish`, hit Enter, and let the Pi reboot.

## Installing ble2mqtt

1. Open a new SSH session, this time using the hostname (e.g. `bedroom.local`) and password you set above.

2. Download Node.js by running `wget https://unofficial-builds.nodejs.org/download/release/v14.15.4/node-v14.15.4-linux-armv6l.tar.gz`

3. Extract the downloaded file by running `tar -xzvf node-v14.15.4-linux-armv6l.tar.gz`

4. Delete the downloaded archive by runing `rm node-v14.15.4-linux-armv6l.tar.gz`

5. Remove the exising node installation:

```
sudo rm -rf /opt/nodejs
sudo unlink /usr/bin/node
sudo unlink /usr/sbin/node
sudo unlink /sbin/node
sudo unlink /usr/local/bin/node
sudo unlink /usr/bin/npm
sudo unlink /usr/sbin/npm
sudo unlink /sbin/npm
sudo unlink /usr/local/bin/npm
```

6. Move new installation into place:

```
sudo mv node-v14.15.4-linux-armv6l /opt/nodejs
sudo ln -s /opt/nodejs/bin/node /usr/bin/node;
sudo ln -s /opt/nodejs/bin/node /usr/sbin/node;
sudo ln -s /opt/nodejs/bin/node /sbin/node;
sudo ln -s /opt/nodejs/bin/node /usr/local/bin/node;
sudo ln -s /opt/nodejs/bin/npm /usr/bin/npm;
sudo ln -s /opt/nodejs/bin/npm /usr/sbin/npm;
sudo ln -s /opt/nodejs/bin/npm /sbin/npm;
sudo ln -s /opt/nodejs/bin/npm /usr/local/bin/npm;
sudo ln -s /opt/nodejs/bin/npx /usr/bin/npx;
sudo ln -s /opt/nodejs/bin/npx /usr/sbin/npx;
sudo ln -s /opt/nodejs/bin/npx /sbin/npx;
sudo ln -s /opt/nodejs/bin/npx /usr/local/bin/npx;


3. To make the commands we install with npm available the $PATH environment variable needs to be extended as well. Edit the file `~/.profile` (e.g. with `nano ~/.profile`) and add the `PATH="$PATH:/opt/nodejs/bin"` to the end of the file. Save, then run `source ~/.profile`.

4. We need to install some other dependencies as well, do so by running `sudo apt-get update && sudo apt-get install build-essential libavahi-compat-libdnssd-dev bluetooth libbluetooth-dev libudev-dev`.

5. Now let's get install ble2mqtt! Run `sudo npm i --global --unsafe-perm ble2mqtt`. You will see messages like the one shown below during the installation process. Don't worry about them - they're not errors!

   ![compilation messages](./compilation-msgs.png)

6. *Optional:* If you want to run Bluetooth related integrations, you should also grant some additional permissions by executing the commands below.

   ```shell
   sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
   sudo setcap cap_net_raw+eip $(eval readlink -f `which hcitool`)
   sudo setcap cap_net_admin+eip $(eval readlink -f `which hciconfig`)
   ```

7. `sudo apt-get install git`

8. add user to /etc/group 'adm' group

9. git clone

10.  wget https://unofficial-builds.nodejs.org/download/release/v14.15.4/node-v14.15.4-linux-armv6l.tar.gz

11. move new node into /opt/node; hook up /usr/local/bin/node & npm

10. npm install -g npx

 sudo npm install --global gulp-cli


npm install gulp




## Configuring ble2mqtt


## Making sure it always runs

1. If ble2mqtt is still running from the previous step, stop it by hitting Ctrl + C on your keyboard.

2. Create a file using `sudo nano /etc/systemd/system/ble2mqtt.service` with the following contents:

   ```
   [Unit]
   Description=ble2mqtt service
   
   [Service]
   ExecStart=/opt/nodejs/bin/ble2mqtt
   WorkingDirectory=/home/pi/ble2mqtt
   Restart=always
   RestartSec=10
   User=pi
   
   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start your service by executing the commands below.

   ```shell
   sudo systemctl enable ble2mqtt.service
   sudo systemctl start ble2mqtt.service
   ```

4. Congratulations, you are done! :confetti_ball: You may check the status of the service at any time with `sudo systemctl status ble2mqtt`. ble2mqtt will now be started when the Pi Zero W boots.
