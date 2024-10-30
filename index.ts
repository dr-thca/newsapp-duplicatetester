const WAYBACK_URL = "https://newsapp-wayback.private.prod.gcp.dr.dk/api";

async function getFrontpages(): Promise<string[]> {
  const response = await fetch(WAYBACK_URL + "/frontpages");
  const data = await response.json();
  return data.map((fp: any) => fp._id);
}

async function getFrontpageData(id: string): Promise<any> {
  const response = await fetch(WAYBACK_URL + "/frontpages/" + id);
  return await response.json();
}
function mergeFrontpageData(data: any): any[] {
  if (!data?.frontPage) {
    return [];
  }
  const content = [
    ...data?.frontPage?.curatedContentWidget,
    ...data?.frontPage?.automatedContentWidget,
  ];
  return sanitizeData(content);
}

function findDuplicateKeys(keys: string[]): string[] {
  const seen = new Set();
  const duplicates = new Set<string>();
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
  for (const [i, id] of frontpageIds.entries()) {
    console.log(`Checking frontpage ${i + 1}/${frontpageIds.length}`);
    const data = await getFrontpageData(id);
    const mergedData = mergeFrontpageData(data);
    const keys = mergedData.map(getKeyExtractorId);
    const newKeyextractor = mergedData.map(keyExtractor);
    const duplicates = findDuplicateKeys(keys);
    const newduplicates = findDuplicateKeys(newKeyextractor);
    if (duplicates.length > 0 || newduplicates.length > 0) {
      console.log("Duplicates:");
      console.log(newduplicates);
      console.log(duplicates);
      console.log("id:");
      console.log(id);
      return;
    }
  }
  //const mergedData = frontPageData.map(mergeFrontpageData);
  //const keys = mergedData.map((data) => data.map(getKeyExtractorId));
  //const duplicates = keys.map(findDuplicateKeys);
  //console.log("Duplicates:");
  //console.log(duplicates.filter((d) => d.length > 0));
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
const getKeyExtractorId = (item: ContentItem, index: number): string => {
  switch (item.__typename) {
    case "FrontPageArticle":
      return index.toString();
    case "FrontPageWidget":
      return item.url + index.toString();
    case "BTeaserGroup":
    case "FrontPageGroup":
    case "FrontPageSlider": {
      const [firstGroupItem] = item.items;
      return firstGroupItem.__typename === "FrontPageArticle"
        ? firstGroupItem.article?.urn ?? index.toString()
        : firstGroupItem.url + index.toString();
    }
    default:
      return index.toString();
  }
};
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
