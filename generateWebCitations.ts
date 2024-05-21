import Cite from "citation-js";
import path from "path";
import fs from "fs";
import { BibEntry, BibFilePresenter, parseBibFile } from "bibtex";
import { globSync } from "glob";
import matter from "gray-matter";
import { replaceRecursively } from "./utils";

type BibContent = ReturnType<typeof parseBibFile>;
type ModifiedFiles = { filePath: string; fileContent: string }[];

const citationFile =
    "/Users/bigsexy/Desktop/current/ulld/apps/website/citations.bib";
const outputFile =
    "/Users/bigsexy/Desktop/current/ulld/apps/website/src/staticData/citations.json";

const webMdxRoot = "/Users/bigsexy/Desktop/current/ulld/apps/website/";

const getFormattedCslCitation = (content: string) => {
    return new Cite(content);
};

const formatCitation = (s: string, index: number) => {
    return `<span style={{
width: "0.5rem",
height: "100%",
position: "relative"
}}><a href='#bib-${s}' className="citation citationAnchor" id="cit-${s}-idx-${index}">${index + 1}</a></span>`;
};

const gatherFileCitations = (content: string) => {
    const regex = /\[@(?<value>[\w|\d|\.|\-|_|\+|\=|\$|\!|\%|\*|\&]*)\]/gm;
    let results: { value: string; length: number; index: number }[] = [];
    let m: any;
    do {
        m = regex.exec(content);
        if (m && m.groups?.value) {
            results.push({
                value: m.groups.value,
                index: m.index,
                length: m[0].length,
            });
        }
    } while (m);
    return results;
};

const getMdxFiles = () => {
    return globSync(`${webMdxRoot}/**/*.mdx`, {
        ignore: "**/__node_modules__/**",
        absolute: true,
    });
};

const getBibCitations = (items: string[], bibContent: BibContent) => {
    let returnItems = items
        .map((a) => {
            return bibContent.getEntry(a) as BibEntry;
        })
        .filter((a) => typeof a !== "undefined");
    return returnItems;
};

const getFileCitations = (
    content: string,
    parsedBib: BibContent,
    ids: string[],
    lower: string[],
    citations: any,
) => {
    let c = content
    const results = gatherFileCitations(c);
    const rList = results.map((r) => r.value.toLowerCase());
    let items = getBibCitations(rList, parsedBib);
    let fr: { htmlCitation: string; id: string; pageIndex: number }[] = [];
    let hasChangedContent = false;
    for (const k of items) {
        const rIndex = rList.indexOf(k._id.toLowerCase());
        const result = results.at(rIndex);
        const _id = ids[lower.indexOf(k._id)];
        const htmlCitation = citations.format("bibliography", {
            format: "html",
            template: "user-defined",
            entry: _id,
        });
        if (result) {
            let _link = formatCitation(k._id, rIndex);
            let newContent = replaceRecursively(
                c,
                new RegExp(`\\[@${result.value.trim()}\\]`, "gmi"),
                _link,
            );
            c = newContent
            hasChangedContent = true;
            fr.push({
                htmlCitation,
                id: k._id,
                pageIndex: rIndex,
            });
        }
    }
    return { results: fr, fileContent: c, hasChangedContent };
};

const writeJson = (data: Record<string, unknown>) => {
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 4), {
        encoding: "utf-8",
    });
};

const writeModifiedFiles = (files: ModifiedFiles) => {
    for (const f of files) {
        fs.writeFileSync(f.filePath, f.fileContent, { encoding: "utf-8" });
    }
};

const writeWebCitations = async () => {
    console.log(`Running writeWebCitations`);
    let content = fs.readFileSync(citationFile, { encoding: "utf-8" });
    let data: Record<string, any> = {};
    const files = getMdxFiles();
    const parsedContent = parseBibFile(content);
    const citationJs = getFormattedCslCitation(content);
    const ids = citationJs.getIds();
    const lower = ids.map((l: string) => l.toLowerCase());

    const modifiedFileContent: ModifiedFiles = [];

    for (const f of files) {
        const fileContent = fs.readFileSync(f, { encoding: "utf-8" });
        let citations = gatherFileCitations(fileContent);
        let grayMatter = matter(fileContent);
        if (citations && grayMatter.data?.id) {
            let fileData = getFileCitations(
                fileContent,
                parsedContent,
                ids,
                lower,
                citationJs,
            );
            if (fileData.hasChangedContent) {
                modifiedFileContent.push({
                    filePath: f,
                    fileContent: fileData.fileContent,
                });
            }
            data[grayMatter.data.id] = {
                citations: fileData.results,
                // bibItems:
            };
        }
    }
    // console.log("modifiedFileContent: ", modifiedFileContent)
    writeJson(data);
    writeModifiedFiles(modifiedFileContent)
};

writeWebCitations();
