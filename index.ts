console.log("Hello via Bun!");

const WAYBACK_URL = "https://newsapp-wayback.private.prod.gcp.dr.dk/api";

function getFrontpages(): Promise<string[]> {
  return fetch(WAYBACK_URL + "/frontpages")
    .then((response) => response.json())
    .then((data) => data.map((fp: any) => fp._id))
    .then((ids) => ids.slice(0, 1000));
}

function getFrontpageData(id: string): Promise<any> {
  console.log("Fetching frontpage data for id: " + id);
  return fetch(WAYBACK_URL + "/frontpages/" + id).then((response) =>
    response.json(),
  );
}
function mergeFrontpageData(data: any): any {
  const content = [
    ...data.frontPage.curatedContentWidget,
    ...data.frontPage.automatedContentWidget,
  ];
  return sanitizeData(content);
}

function findDuplicateKeys(keys: string[]): string[] {
  const seen = new Set();
  const duplicates = new Set();
  keys.forEach((key) => {
    if (seen.has(key)) {
      duplicates.add(key);
    } else {
      seen.add(key);
    }
  });
  return Array.from(duplicates);
}

async function main() {
  const frontpageIds = await getFrontpages();
  console.log("Frontpage ids:");
  console.log(frontpageIds);
  const frontPageData = await Promise.all(frontpageIds.map(getFrontpageData));
  const mergedData = frontPageData.map(mergeFrontpageData);
  const keys = mergedData.map((data) => data.map(keyExtractor));
  const duplicates = keys.map(findDuplicateKeys);
  console.log("Duplicates:");
  console.log(duplicates.filter((d) => d.length > 0));
}

type ContentItem = any;

function sanitizeData(data: ContentItem[]) {
  return data.reduce((accumulator: ContentItem[], currentItem) => {
    switch (currentItem.__typename) {
      case "FrontPageArticle":
        if (currentItem.article || currentItem.url)
          accumulator.push(currentItem);
        break;
      case "FrontPageSlider":
      case "FrontPageGroup":
        const filteredItems = currentItem.items.filter((item) =>
          item.__typename === "FrontPageArticle"
            ? item.article || item.url
            : item.url,
        );

        if (filteredItems.length) {
          accumulator.push({ ...currentItem, items: filteredItems });
        }
        break;
      default:
        accumulator.push(currentItem);
    }
    return accumulator;
  }, []);
}

function keyExtractor(item: ContentItem, index: number): string {
  switch (item.__typename) {
    case "FrontPageArticle":
      return `Article: ${item.url}`;
    case "FrontPageWidget":
      return `Widget: ${item.url}-${index}`;
    case "BTeaserGroup":
    case "FrontPageGroup":
    case "FrontPageSlider":
      return `Group: ${item.items.map((groupItem) => groupItem.url).join("-")}`;
    case "FrontPageEndCurated":
      return `End curated: ${index}`;
    default:
      return index.toString();
  }
}
main();
