//terminator.js (Reference >> https://zenn.dev/yonda/articles/05eff6fd381ebb)
export const calculate = (date, division = 360) => {
    
    const getJulianDate = (date) => {
        const d = date instanceof Date ? date.getTime() : date;
        return d / 86400000 + 2440587.5;
    };

    const getGreenwichMeanSiderealTime = (jd) => {
        return (18.697374558 + 24.06570982441908 * (jd - 2451545)) % 24;
    };

    const getSunEclipticLongitude = (jd) => {
        const n = jd - 2451545;
        const L = (280.46 + 0.9856474 * n) % 360;
        const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;
        return (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * Math.PI / 180;
    };

    const getEclipticObliquity = (jd) => {
        const t = (jd - 2451545) / 36525;
        return ((84381.406 - 46.836769 * t - 0.00059 * t ** 2 + 0.001813 * t ** 3) / 3600) * Math.PI / 180;
    };

    const getSunEquatorialPosition = (longitude, obliquity) => {
        let alpha = Math.atan(Math.tan(longitude) * Math.cos(obliquity));
        const delta = Math.asin(Math.sin(longitude) * Math.sin(obliquity));

        if (Math.sin(longitude) > 0) {
            if (Math.sin(alpha) < 0) alpha += Math.PI;
        } else {
            if (0 < Math.sin(alpha)) alpha += Math.PI;
        }

        return [alpha, delta];
    };

    const getLatitude = (longitude, alpha, delta, gmst) => {
        const hourAngle = (gmst * 15 * Math.PI / 180 + longitude) - alpha;
        return Math.atan(-Math.cos(hourAngle) / Math.tan(delta));
    };

    const jd = getJulianDate(date);
    const gmst = getGreenwichMeanSiderealTime(jd);

    const sunEclipticLongitude = getSunEclipticLongitude(jd);
    const eclipticObliquity = getEclipticObliquity(jd);
    const [alpha, delta] = getSunEquatorialPosition(sunEclipticLongitude, eclipticObliquity);

    const longlats = [];
    const diffDeg = 360 / division;
    for (let longitude = -180; longitude < 180; longitude += diffDeg) {
        const latitude = getLatitude(longitude * Math.PI / 180, alpha, delta, gmst);
        longlats.push([longitude, latitude * 180 / Math.PI]);
    }
    const latitude = getLatitude(Math.PI, alpha, delta, gmst);
    longlats.push([180, latitude * 180 / Math.PI]);

    if (delta > 0) {
        longlats.push([180, -90]);
        longlats.push([-180, -90]);
        longlats.push(longlats[0]);
        longlats.reverse();
    } else {
        longlats.push([180, 90]);
        longlats.push([-180, 90]);
        longlats.push(longlats[0]);
    }

    return {
        type: "Feature",
        properties: {
            "datetime": date.toISOString()
        },
        geometry: {
            type: "Polygon",
            coordinates: [longlats]
        }
    };
};
