import { DateTime } from 'luxon';

/**
 * IANAタイムゾーン名から時刻情報を取得
 * @param {string} tzid - IANAタイムゾーン名（例: 'Asia/Tokyo'）
 * @returns {Object} 時刻情報
 */
export function getTimezoneInfo(tzid) {
    try {
        const dt = DateTime.now().setZone(tzid);
        if (dt.isValid) {
            return {
                time: dt.toFormat('HH:mm'),
                isDST: dt.isInDST,
                zoneName: tzid,
                offset: dt.offset / 60  // 分から時間に変換
            };
        }
    } catch (e) {
        console.error(`Error with IANA timezone ${tzid}:`, e);
    }

    // フォールバック: システムのローカル時間
    return {
        time: DateTime.now().toFormat('HH:mm'),
        isDST: false,
        zoneName: 'Unknown',
        offset: 0
    };
}

/**
 * タイムゾーン名を人間が読みやすい形式に変換
 * @param {string} tzid - IANAタイムゾーン名
 * @returns {Object} 整形された表示情報
 */
export function formatZoneDisplay(tzid) {
    const zoneParts = tzid.split('/');
    const region = zoneParts[0];
    const city = zoneParts[zoneParts.length - 1].replace(/_/g, ' ');
    
    return {
        region: region,
        city: city,
        full: `${city}, ${region}`
    };
}

/**
 * タイムゾーン名と地域名からIANAタイムゾーン名を推測
 * @param {string} timeZone - Natural Earthのタイムゾーン名
 * @param {string} places - 地域名
 * @returns {string|null} IANAタイムゾーン名
 */
/**
 * タイムゾーン名と地域名からIANAタイムゾーン名を推測
 * @param {string} timeZone - タイムゾーン名
 * @param {string} places - 地域名
 * @returns {string|string[]|null} IANAタイムゾーン名または名前の配列
 */
function guessIANAZone(timeZone, places) {
    // 地域名でのマッピング検索
    const regionMapping = timezoneMapping.regionMappings[places];
    if (regionMapping) {
        return regionMapping;
    }

    // タイムゾーン略称からの検索
    const tzAbbr = timeZone.toUpperCase();
    const abbrMapping = timezoneMapping.abbreviations[tzAbbr];
    if (abbrMapping) {
        return abbrMapping;
    }

    // 部分一致での検索
    for (const [region, mapping] of Object.entries(timezoneMapping.regionMappings)) {
        const normalizedRegion = region.toLowerCase();
        const normalizedPlaces = places.toLowerCase();
        
        // カンマで区切られた地域名を個別にチェック
        const placesList = normalizedPlaces.split(',').map(p => p.trim());
        const regionList = normalizedRegion.split(',').map(r => r.trim());
        
        // 部分一致をチェック
        const hasMatch = placesList.some(place => 
            regionList.some(region => 
                region.includes(place) || place.includes(region)
            )
        );
        
        if (hasMatch) {
            return mapping;
        }
    }

    return null;
}
