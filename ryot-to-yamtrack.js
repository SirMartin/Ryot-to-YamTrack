const fs = require("fs");
const {parse} = require("csv-parse");
const MovieDB = require('node-themoviedb');

// Fill the API key from TMDB here: https://www.themoviedb.org/settings/api
const tmdb_api_key = "your-api-key-here";

// Fill the path to the Ryot shows export JSON file here. Or just put it on the same folder and name it "ryot-shows.json"
const ryot_json = require('./ryot-shows.json');

const mdb = new MovieDB(tmdb_api_key, {language: "es"});

function getStatus(show) {
    if (show.collections.includes("Completed")) {
        return "Completed";
    }

    return "In progress";
}

function generateYamtrackShowInfo(s, details, startDate, endDate, showName) {
    return {
        media_id: s.identifier,
        source: "tmdb",
        media_type: "tv",
        title: showName,
        image: `https://image.tmdb.org/t/p/w500/${details.data.poster_path}`,
        season_number: "",
        episode_number: "",
        score: "",
        progress: "",
        status: getStatus(s),
        repeats: "",
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        notes: "",
        watch_date: ""
    };
}

function getSeasonPoster(season, details) {
    const firstSeason = details.data.seasons[0];
    if (firstSeason.name.toLowerCase().includes("special")) {
        const seasonFound = details.data.seasons[season];
        return seasonFound.poster_path;
    }

    return details.data.seasons[season - 1].poster_path;
}

function generateSeasonsMetadata(seasons, s, startDate, endDate, details, showName) {
    return seasons.map((season) => {
        return {
            media_id: s.identifier,
            source: "tmdb",
            media_type: "season",
            title: showName,
            image: `https://image.tmdb.org/t/p/w500${getSeasonPoster(Number(season), details)}`,
            season_number: season,
            episode_number: "",
            score: "",
            progress: "",
            status: getStatus(s),
            repeats: 0,
            start_date: startDate.toISOString().split("T")[0],
            end_date: endDate.toISOString().split("T")[0],
            notes: "",
            watch_date: "",
        };
    });
}

async function convertToYamtrack(shows) {
    const result = [];
    for (const s of shows) {
        const details = await mdb.tv.getDetails({pathParameters: {tv_id: s.identifier}})
        const showName = `"${details.data.name}"`;
        let startDate = new Date();
        let endDate = new Date(1900,1);
        let seasons  = [];
        for (const episode of s.seen_history) {
            if (new Date(episode.ended_on) < startDate) {
                startDate = new Date(episode.ended_on);
            }

            if (new Date(episode.ended_on) > endDate) {
                endDate = new Date(episode.ended_on);
            }

            result.push({
                media_id: s.identifier,
                source: "tmdb",
                media_type: "episode",
                title: showName,
                image: `https://image.tmdb.org/t/p/w500${details.data.poster_path}`,
                season_number: episode.show_season_number,
                episode_number: episode.show_episode_number,
                score: "",
                progress: episode.progress,
                status: getStatus(s),
                repeats: 0,
                start_date: "",
                end_date: "",
                notes: "",
                watch_date: episode.ended_on,
            });

            // Check seasons
            if (!seasons.includes(episode.show_season_number)) {
                seasons.push(episode.show_season_number);
            }
        }

        const seasonsMetadata = generateSeasonsMetadata(seasons, s, startDate, endDate, details, showName);
        result.push(...seasonsMetadata);

        const showMetadata = generateYamtrackShowInfo(s, details, startDate, endDate, showName);
        result.push(showMetadata);
    }

    return result;
}

function jsonToCsv(json) {
    const headers = Object.keys(json[0]);
    const rows = json.map(obj => headers.map(header => obj[header]).join(','));
    return [headers.join(','), ...rows].join('\n');
}

async function run() {
    const shows = ryot_json.media;


    const yamtrackData = await convertToYamtrack(shows);
    const csv = jsonToCsv(yamtrackData);
    //
    fs.writeFileSync("./result.csv", csv);
}

run();
