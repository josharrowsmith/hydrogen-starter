import { defer, type LoaderFunctionArgs } from '@netlify/remix-runtime';
import { useLoaderData, Link, type MetaFunction } from '@remix-run/react';
import { json } from '@shopify/remix-oxygen';
import { Image, Money, flattenConnection, AnalyticsPageType } from '@shopify/hydrogen';
import ProductGrid from "../components/ProductGrid"
import { SortFilter } from '../components/SortFilter';

export const meta: MetaFunction = () => {
  return [{ title: 'Hydrogen | Home' }];
};

export async function loader({ context, request }: LoaderFunctionArgs) {
  const handle = "parts"
  const searchParams = new URL(request.url).searchParams;
  const cursor = searchParams.get('cursor');
  const filters = [];
  const appliedFilters = [];
  const knownFilters = ['productVendor', 'productType',];
  const available = 'available';
  const variantOption = 'variantOption';


  for (const [key, value] of searchParams.entries()) {
    if (available === key) {
      filters.push({ available: value === 'true' });
      appliedFilters.push({
        label: value === 'true' ? 'In stock' : 'Out of stock',
        urlParam: {
          key: available,
          value,
        },
      });
    } else if (knownFilters.includes(key)) {
      filters.push({ [key]: value });
      appliedFilters.push({ label: value, urlParam: { key, value } });
    } else if (key.includes(variantOption)) {
      const [name, val] = value.split(':');
      filters.push({ variantOption: { name, value: val } });
      appliedFilters.push({ label: val, urlParam: { key, value } });
    } else if (key.includes("colour_group")) {
      filters.push({ variantMetafield: { namespace: "custom", key: key, value: value } })
      appliedFilters.push({ label: "colour", urlParam: { key, value } });
    }
  }

  if (searchParams.has('minPrice') || searchParams.has('maxPrice')) {
    const price = {};
    if (searchParams.has('minPrice')) {
      price.min = Number(searchParams.get('minPrice')) || 0;
      appliedFilters.push({
        label: `Min: $${price.min}`,
        urlParam: { key: 'minPrice', value: searchParams.get('minPrice') },
      });
    }
    if (searchParams.has('maxPrice')) {
      price.max = Number(searchParams.get('maxPrice')) || 0;
      appliedFilters.push({
        label: `Max: $${price.max}`,
        urlParam: { key: 'maxPrice', value: searchParams.get('maxPrice') },
      });
    }
    filters.push({
      price,
    });
  }

  const { collection, collections } = await context.storefront.query(
    COLLECTION_QUERY,
    {
      variables: {
        handle: handle,
        pageBy: 12,
        cursor,
        filters,
        country: context.storefront.i18n.country,
        language: context.storefront.i18n.language,
      },
    },
  );

  if (!collection) {
    throw new Response(null, { status: 404 });
  }

  const collectionNodes = flattenConnection(collections);

  return json({
    collection,
    appliedFilters,
    collections: collectionNodes,
    analytics: {
      pageType: AnalyticsPageType.collection,
      handle,
      resourceId: collection.id,
    },
  });
}

export default function Homepage() {
  const { collection, collections, appliedFilters } = useLoaderData();
  const plpDrawerFilters = collection.products.filters.filter(plpFilter =>
    plpFilter.id == 'filter.v.price' || plpFilter.id == 'filter.p.product_type' || plpFilter.id == 'filter.v.option.color' || plpFilter.id == 'filter.p.vendor' || plpFilter.id == 'filter.v.m.custom.colour_group'
  );

  return (
    <>
      <header className="grid w-full gap-8 py-8 justify-items-start">
      </header>
      <SortFilter
        filters={plpDrawerFilters}
        appliedFilters={appliedFilters}
        collections={collections}
      >
        <ProductGrid
          key={collection.id}
          collection={collection}
          url={`/collections/${collection.handle}`}
          data-test="product-grid"
        />
      </SortFilter>
    </>
  );
}

const COLLECTION_QUERY = `#graphql
  query CollectionDetails(
    $handle: String!
    $cursor: String
    $filters: [ProductFilter!]
    $pageBy: Int!
  ) {
    collection(handle: $handle) {
      id
      title
      description
      handle
      products(
        first: $pageBy
        after: $cursor
        filters: $filters
      ) {
        filters {
          id
          label
          type
          values {
            id
            label
            count
            input
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          publishedAt
          handle
          variants(first: 1) {
            nodes {
              id
              image {
                url
                altText
                width
                height
              }
              price {
                amount
                currencyCode
              }
              compareAtPrice {
                amount
                currencyCode
              }
              selectedOptions {
                name
                value
              }
              product {
                handle
                title
              }
            }
          }
        }
      }
    }
    collections(first: 100) {
      edges {
        node {
          title
          handle
        }
      }
    }
  }
`;
