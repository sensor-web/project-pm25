#!/bin/bash

while test $# -gt 0; do
  case "$1" in
  	--freq*)
	    export FREQ=`echo $1 | sed -e 's/^[^=]*=//g'`
        echo "--freq was triggered, Parameter: $FREQ" >&2
        shift
        ;;
    --dry-run)
        export DRYRUN=true
        echo "--dry-run was triggered" >&2
        shift
        ;;
    *)
        echo "Invalid option: $1" >&2
        exit 1
        ;;
  esac
done

if [ -z $FREQ ]; then
	echo "--freq=[hourly|daily] parameter required"
else
	if [ $FREQ = "hourly" ]; then
		echo "*** Running updateData ***" >&2
		node ./updateData.js
	elif [ $FREQ = "daily" ]; then
		echo "*** Running updateData ***" >&2
		node ./updateData.js &&
		echo "*** Running updateStations ***" >&2
		node ./updateStations.js
	fi &&

	echo "*** Running updateStationsToDb ***" >&2
	node ./updateStationsToDb.js &&
	echo "*** Running updateRegionSummary ***" >&2
	node ./updateRegionSummary.js &&

	echo "*** Running notifyConcentration ***" >&2
	if [ $DRYRUN ]; then
		node ./notifyConcentration.js --dry-run
	else
		node ./notifyConcentration.js
	fi &&

	echo "*** Running genSitemap ***" >&2
	if [ $FREQ = "daily" ]; then
		node ./genSitemap.js
	fi
fi
