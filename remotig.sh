# console on UART - for DietPi distro
#echo "stop console on UART"
#systemctl stop serial-getty@ttyAMA0.service

# node
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $DIR
LOG="remotig-`date \"+%Y%m%d\"`.log"
rm remotig.log >/dev/null
ln -s ${LOG} remotig.log
node remotig.js >>${LOG} 2>&1 &
