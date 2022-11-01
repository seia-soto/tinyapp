import * as React from 'react';

const observerController = {
	subscriptions: [] as Array<(records: MutationRecord[]) => void>,
	observer: new MutationObserver(mut => {
		for (const sub of observerController.subscriptions) {
			sub(mut);
		}
	}),
};

const Heading: React.FC = () => (
	<div className='container'>
		<h1>Tinyapp</h1>
		<p>
      A website can be posted to check if in-app browser is injecting their tracker script.
      You can post the link on the web and check if an app is tracking you.
		</p>
		<p>Developed by HoJeong Go. Checkout details <a href='https://github.com/seia-soto/tinyapp'>here</a>.</p>

		<ul>
			<li>navigator.userAgent: {navigator.userAgent}</li>
		</ul>
	</div>
);

type LinkProps = {
	href: string;
	text?: string;
};

const Link: React.FC<LinkProps> = ({href, text = href}) => (
	<a href={href}>{text}</a>
);

const Statics: React.FC = () => {
	const [sources, setSources] = React.useState<string[]>([]);

	React.useEffect(() => {
		const blob: Record<string, string> = {};
		const list = () => {
			const scriptElements: NodeListOf<HTMLScriptElement> = document.querySelectorAll('script');
			const styleElements: NodeListOf<HTMLLinkElement> = document.querySelectorAll('link[rel="stylesheet"],style');

			setSources([
				...Array
					.from(scriptElements)
					.map(el => {
						const src = el.getAttribute('src');
						const inline = el.innerHTML.toString();
						const cacheKey = src ?? inline;

						if (typeof src === 'string') {
							return src;
						}

						if (!cacheKey) {
							return '#';
						}

						if (typeof blob[cacheKey] !== 'undefined') {
							return blob[cacheKey];
						}

						blob[cacheKey] = URL.createObjectURL(new Blob([inline]));

						return blob[cacheKey];
					}),
				...Array
					.from(styleElements)
					.map(el => {
						const href = el.getAttribute('href');
						const inline = el.innerHTML.toString();
						const cacheKey = href ?? inline;

						if (typeof href === 'string') {
							return href;
						}

						if (!cacheKey) {
							return '#';
						}

						if (typeof blob[cacheKey] !== 'undefined') {
							return blob[cacheKey];
						}

						blob[cacheKey] = URL.createObjectURL(new Blob([inline]));

						return blob[cacheKey];
					}),
			]);
		};

		const delay = 100;
		let request: NodeJS.Timeout;

		observerController.subscriptions.push(() => {
			if (request) {
				clearTimeout(request);
			}

			request = setTimeout(() => {
				list();
			}, delay);
		});

		list();
	}, []);

	return (
		<div className='container'>
			<h2>Statics</h2>
			<p>
        This section shows the remote and local artifacts used.
				&nbsp;<b>/out.js</b> and <b>/index.css</b> is provided by Tinyapp itself.
				&nbsp;<b>#</b> is for the empty blocks.
			</p>

			<ul>
				{
					sources
						.map((source, i) => <li key={`${source}${i}`}><Link href={source}></Link></li>)
				}
				{
					!sources.length && <li>No static files detected in this site so far.</li>
				}
			</ul>
		</div>
	);
};

const EventListeners: React.FC = () => {
	const [listeners, setListeners] = React.useState<string[]>([]);
	const [logs, setLogs] = React.useState<string[]>([]);

	React.useEffect(() => {
		const unload: Array<() => void> = [];

		const hookElementEvent = (element: Element) => {
			const lagacyElement = element;
			const legacyAddEventListener = element.addEventListener;

			element.addEventListener = new Proxy(
				legacyAddEventListener,
				{
					apply(target, thisArg, argArray) {
						setListeners(state => [...state, argArray[0] as string]);

						const fn = argArray[1] as (..._: any[]) => any;

						// eslint-disable-next-line @typescript-eslint/no-unsafe-return
						return Reflect.apply(target, thisArg, [
							argArray[0],
							(...args: any) => {
								fn(...args);

								setLogs(state => [...state, JSON.stringify([argArray[0], args])]);
							},
						]);
					},
				},
			);

			element = new Proxy(
				element,
				{
					set(target, p, newValue, receiver) {
						if (typeof p === 'string' && p.startsWith('on')) {
							setListeners(state => [...state, p]);
						}

						return Reflect.set(target, p, newValue, receiver);
					},
				},
			);

			unload.push(() => {
				element.addEventListener = legacyAddEventListener;
				element = lagacyElement;
			});
		};

		const createProxyForGlobals = (parent: any, prop: string) => {
			const legacyMethod = parent[prop] as () => any;

			parent[prop] = new Proxy(legacyMethod, {
				apply(target, thisArg, argArray) {
					setListeners(state => [...state, argArray[0] as string]);

					const fn = argArray[1] as (..._: any[]) => any;

					// eslint-disable-next-line @typescript-eslint/no-unsafe-return
					return Reflect.apply(target, thisArg, [
						argArray[0],
						(...args: any) => {
							fn(...args);

							setLogs(state => [...state, JSON.stringify([argArray[0], args])]);
						},
					]);
				},
			});

			unload.push(() => {
				parent[prop] = legacyMethod;
			});
		};

		hookElementEvent(Element.prototype);
		createProxyForGlobals(window, 'addEventListener');
		createProxyForGlobals(window.document, 'addEventListener');

		observerController.subscriptions.push(muts => {
			for (const mut of muts) {
				if (mut.attributeName?.startsWith('on')) {
					setListeners(state => [...state, mut.attributeName!]);
				}
			}
		});

		return () => {
			for (const unloader of unload) {
				unloader();
			}
		};
	}, []);

	return (
		<div className='container'>
			<h2>Event Listeners</h2>
			<p>This section shows the catchable event listener attachments.</p>

			<ul>
				{
					listeners.map((listener, i) => <li key={`${listener}${i}`}>{listener}</li>)
				}
				{
					!listeners.length && <li>No event listener has been attached so far.</li>
				}
			</ul>

			<ul>
				{
					logs.map((log, i) => <li key={`${log}${i}`}>{log}</li>)
				}
				{
					!logs.length && <li>No arguments has been passed so far.</li>
				}
			</ul>
		</div>
	);
};

const Requests: React.FC = () => {
	const [urls, setUrls] = React.useState<string[]>([]);

	React.useEffect(() => {
		const legacyFetch = window.fetch;

		window.fetch = new Proxy(legacyFetch, {
			apply(target, thisArg, argArray) {
				setUrls([...urls, JSON.stringify(argArray)]);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				return Reflect.apply(target, thisArg, argArray);
			},
		});

		const legacyXhrOpen = window.XMLHttpRequest.prototype.open;

		window.XMLHttpRequest.prototype.open = new Proxy(legacyXhrOpen, {
			apply(target, thisArg, argArray) {
				setUrls([...urls, JSON.stringify(argArray)]);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				return Reflect.apply(target, thisArg, argArray);
			},
		});

		const legacyRequest = window.Request;

		window.Request = new Proxy(legacyRequest, {
			construct(target, argArray, newTarget) {
				setUrls([...urls, JSON.stringify(argArray)]);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				return Reflect.construct(target, argArray, newTarget);
			},
		});

		return () => {
			window.fetch = legacyFetch;
			window.XMLHttpRequest.prototype.open = legacyXhrOpen;
			window.Request = legacyRequest;
		};
	}, []);

	return (
		<div className='container'>
			<h2>Requests</h2>
			<p>This section shows the result of hooking <code>fetch</code>, <code>XMLHttpRequest</code> and <code>Request</code>.</p>

			<ul>
				{
					urls.map((url, i) => <li key={`${url}${i}`}>{url}</li>)
				}
				{
					!urls.length && <li>No request has been made so far.</li>
				}
			</ul>
		</div>
	);
};

const Cookies: React.FC = () => (
	<div className='container'>
		<h2>Cookies</h2>
		<p>We show client-side cookies set in the website. By default we do not set any cookie, so shown are all from in-app browser.</p>

		<p>Cookie string: {document.cookie.toString()}</p>
	</div>
);

const App: React.FC = () => {
	React.useEffect(() => {
		observerController.observer.observe(document.querySelector('html') as HTMLElement, {
			attributes: true,
			childList: true,
			subtree: true,
		});

		return () => {
			observerController.observer.disconnect();
			observerController.subscriptions = [];
		};
	}, []);

	return (
		<>
			<Heading />
			<Statics />
			<EventListeners />
			<Requests />
			<Cookies />
		</>
	);
};

export default App;
