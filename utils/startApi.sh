#!/bin/bash

cd "$(realpath "$0")/../../api/"
sudo npm i
sudo node main.js
