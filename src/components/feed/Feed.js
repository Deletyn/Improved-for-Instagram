import FetchComponent from './FetchComponent'
import Loading from '../Loading'
import Post from './Post'
import Sentinel from './Sentinel'
//import VirtualList from './VirtualList'
import Stories from './Stories'
import bind from 'autobind-decorator'
import withIntersectionObserver from './withIntersectionObserver'
import { Fragment, h } from 'preact'
import { shallowDiffers } from '../Utils'
//import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'preact/compat'

class Feed extends FetchComponent {
	state = {
		cursor: '',
		hasNextPage: true,
		isNextPageLoading: false,
		items: window.__additionalData?.feed?.data?.user?.edge_web_feed_timeline?.edges || [],
		nextCount: 0,
		prevCount: 0,
	}

	static fetchObj = {
		cached_feed_item_ids: [],
		fetch_comment_count: 4,
		fetch_like: 3,
		fetch_media_item_count: 12,
		fetch_media_item_cursor: '',
		has_stories: false, // @todo nice feature?
		has_threaded_comments: true,
	}

	constructor(props) {
		super(props)

		this.queryID = '6b838488258d7a4820e48d209ef79eb1' // feed query id // @TODO Update regularely, last check 13.04.2020

		this.state.cursor = window.__additionalData.feed?.data?.user?.edge_web_feed_timeline?.page_info?.end_cursor || ''
		this.state.count = this.state.items.length

		this.SentinelWithObserver = withIntersectionObserver(Sentinel, {
			//delay: 16,
			root: document.getElementById('ige_feed'),
			trackVisibility: false,
		})
	}

	shouldComponentUpdate(nextProperties, nextState) {
		return shallowDiffers(this.state, nextState)
	}

	async fetchNext(cb) {
		const obj = { ...Feed.fetchObj }
		obj.fetch_media_item_cursor = this.state.cursor

		const response = await this.fetch('/graphql/query/?query_hash=' + this.queryID + '&variables=' + JSON.stringify(obj), {
			headers: this.getHeaders(false),
		})

		if (response.status !== 'ok') {
			this.setState({ hasNextPage: false, isNextPageLoading: false })
			return
		}

		const nextCursor = response?.data?.user?.edge_web_feed_timeline?.page_info.end_cursor

		this.setState(
			(prevState, props) => {
				const nextItems = prevState.items.concat(response.data.user.edge_web_feed_timeline.edges)
				return {
					cursor: nextCursor,
					hasNextPage: nextCursor !== undefined,
					isNextPageLoading: false,
					items: nextItems,
					nextCount: nextItems.length,
					prevCount: prevState.nextCount,
				}
			},
			() => {
				this.isNextPageLoading = false
				cb()
			}
		)
	}

	componentDidUpdate() {
		;/\s*/g.exec('') // free regexp memory
	}

	componentDidMount() {
		this.componentDidUpdate()
	}

	@bind
	renderItems() {
		const { items, prevCount } = this.state,
			arr = []
		for (let i = 0; i < items.length; ++i) {
			const current = items[i],
				type = current.node.__typename
			if (type !== 'GraphImage' && type !== 'GraphSidecar' && type !== 'GraphVideo' && type !== 'GraphStoriesInFeedItem') {
				console.info('New typename:', current.node.__typename)
				continue
			}

			const len = arr.length
			if (len === 8 || len === 25)
				// two rows, so stories can load out of view
				arr.push(<Stories cursor={i < 10 ? 0 : 14} additionalClass={i >= prevCount ? 'ige_fade' : ''} key={current.node.id} />)

			if (type === 'GraphStoriesInFeedItem') continue

			arr.push(<Post data={current.node} key={current.node.shortcode} additionalClass={i >= prevCount ? 'ige_fade' : ''} />)
		}

		return arr
	}

	render() {
		const { hasNextPage, isNextPageLoading } = this.state

		// Only load 1 page of items at a time.
		// Pass an empty callback to InfiniteLoader in case it asks us to load more than once.
		const loadMoreItems = isNextPageLoading ? () => {} : () => this.loadNextPage(true)
		const Sentinel = this.SentinelWithObserver

		// @TODO Unload out of viewport imgs/videos

		return (
			<div class="ige_virtual">
				<div class="ige_virtual_container">
					{this.renderItems()}
					<Sentinel onVisible={loadMoreItems} />
					{!hasNextPage && !isNextPageLoading ? <div>End of feed, try reloading the page.</div> : <Loading />}
				</div>
			</div>
		)

		//return <VirtualList itemCount={items.length / 8} renderItems={this.renderItems} className="ige_virtual" />
	}
}

// __optimizeReactComponentTree is only known to Prepack
// so we wrap it in a conditional so the code still works
// for local development testing without Prpeack
if (typeof __optimizeReactComponentTree !== 'undefined') {
	__optimizeReactComponentTree(App)
}

export default Feed
