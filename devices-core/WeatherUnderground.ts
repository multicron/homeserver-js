
'use strict';


import {
    DataCollector
} from "@homeserver-js/device-js";

import {
    HTTPGetPollJSON
} from "@homeserver-js/transceiver-core";

import logger from "debug"; const debug = logger('homeserver:device:weatherunderground');


// {
//     "observations": [{
//         "stationID": "KMDTAKOM12",
//         "obsTimeUtc": "2021-01-09T02:47:28Z",
//         "obsTimeLocal": "2021-01-08 21:47:28",
//         "neighborhood": "Sligo Park Hills",
//         "softwareType": "AMBWeatherV4.1.6",
//         "country": "US",
//         "solarRadiation": 0.0,
//         "lon": -77.014999,
//         "realtimeFrequency": null,
//         "epoch": 1610160448,
//         "lat": 38.978001,
//         "uv": 0.0,
//         "winddir": 243,
//         "humidity": 73.0,
//         "qcStatus": 1,
//         "imperial": {
//             "temp": 32.7,
//             "heatIndex": 32.7,
//             "dewpt": 25.0,
//             "windChill": 32.7,
//             "windSpeed": 0.2,
//             "windGust": 1.1,
//             "pressure": 29.66,
//             "precipRate": 0.00,
//             "precipTotal": 0.00,
//             "elev": 289.0
//         }
//     }]
// }

export class WeatherUnderground extends DataCollector {
    constructor(
        name: string,
        url: string,
        period: number
    ) {
        super(name);
        this.with(new HTTPGetPollJSON({ url: url }, period, 'data'));
        this.on('change_data', (new_data) => {
            debug("Got data from WU", new_data);
            let obs = new_data?.observations;
            if (Array.isArray(obs)) {
                let units;
                let top = obs[0];
                if (top) {
                    if (top.imperial) units = "imperial";
                    else if (top.metric) units = "metric";
                    else if (top.uk_hybrid) units = "uk_hybrid";

                    let val = top.imperial || top.metric || top.uk_hybrid;

                    if (val) {
                        this.modify({
                            units: units,
                            humidity: top.humidity,
                            wind_direction: top.winddir,
                            solar_radiation: top.solarRadiation,
                            observation_time_local: top.obsTimeLocal,
                            observation_time_utc: top.obsTimeUtc,
                            station_id: top.stationID,
                            neighborhood: top.neighborhood,
                            temperature: val.temp,
                            wind_speed: val.windSpeed,
                            wind_gust: val.windGust,
                            wind_chill: val.windChill,
                            dew_point: val.dewpt,
                            air_pressure: val.pressure,
                            heat_index: val.heatIndex,
                            precip_rate: val.precipRate,
                            precip_total: val.precipTotal,

                        });
                    }

                }
            }
        });
    }
}

