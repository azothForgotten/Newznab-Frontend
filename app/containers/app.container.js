import React from 'react';
import Search from '../components/search.component';
import Details from '../components/details.component';
import NzbSearch from '../components/nzbsearch.component';
import ResultList from '../components/resultList.component';
import Menu from '../components/menu.component';
import Settings from '../components/settings.component';
import NZBGet from 'nzbget-api';
import FlatButton from 'material-ui/FlatButton';
import LinearProgress from 'material-ui/LinearProgress';
var MovieDB = require('moviedb');

const {ipcRenderer} = window.require('electron');

// AppContainer class
class AppContainer extends React.Component {
    // AppContainer constructor
    constructor(props) {
    	super(props);

		this.state = {
			settings: {
				tmdb_api_key: '',
				newznab_endpoint: '',
				newznab_api_key: '',
				nzbget_host: '',
				nzbget_port: '',
				nzbget_user: '',
				nzbget_password: ''
			},
			movie: {backdrop_path: '', title: '', release_date: '', overview: '', id: ''},
			inProgress: false,
			openSettings: false,
			movies: [],
			nzbItems: []
		}
    }

	componentWillMount() {
		ipcRenderer.on('getEnv', (event, arg) => {
			if (!localStorage.getItem('settings') && arg.TMDB_API_KEY) {
				localStorage.setItem('settings', JSON.stringify(
					{
						tmdb_api_key: arg.TMDB_API_KEY,
						newznab_endpoint: arg.NEWZNAB_ENDPOINT,
						newznab_api_key: arg.NEWZNAB_API_KEY,
						nzbget_host: arg.NZBGET_HOST,
						nzbget_port: arg.NZBGET_PORT,
						nzbget_user: arg.NZBGET_USER,
						nzbget_password: arg.NZBGET_PASSWORD
					}
				));
			}
			if (localStorage.getItem('settings')) {
				var userSettings = JSON.parse(localStorage.getItem('settings'));
				this.setState({settings: userSettings});
			}
			if (userSettings) {
				var nzbGetOptions = {
					host: userSettings.nzbget_host,
					port: userSettings.nzbget_port,
					login: userSettings.nzbget_user,
					hash: userSettings.nzbget_password,
					testJsonDir: `${__dirname}/`
				}
				console.log(nzbGetOptions);
				this.nzbGet = new NZBGet(nzbGetOptions);
			}
			if (this.state.settings && this.state.settings.tmdb_api_key)
				this.mdb = MovieDB(this.state.settings.tmdb_api_key);
			else	
				this.setState({openSettings: true});
		});
		ipcRenderer.send('getEnv');
	}
	// componentDidMount lifecycle method. Called once a component is loaded
	componentDidMount() {
	}

	handleSelect(value, item) {
		let movie = this.state.movies[item];
		this.mdb.movieInfo({id: movie.id},
			(err, res) => this.setState({movie: res})
		);
		this.setState({nzbItems: []});
	}

	handleChange(value) {
		let self = this;
		console.log('changed: ' + value);
		this.mdb.searchMovie({ query: value},
			(err, res) => {
				console.log(res);
				this.setState({movies: res.results});
				console.log(this.state);
			}
		);
		this.setState({nzbItems: []});
	}

	handleClick() {
		var imdb = this.state.movie.imdb_id.replace('tt','');
		this.setState({inProgress: true})
		console.log(`https://${this.state.settings.newznab_endpoint}?t=movie&apikey=${this.state.settings.newznab_api_key}&imdbid=${imdb}&limit=100&o=json`);
		fetch(`https://${this.state.settings.newznab_endpoint}?t=movie&apikey=${this.state.settings.newznab_api_key}&imdbid=${imdb}&limit=100&o=json`)
			.then((response) => response.json())
			.then((response) => {
				console.log(response);
				if (response.channel) {
					this.setState({nzbItems: response.channel.item, inProgress: false});
				}
				else
					this.setState({inProgress: false});
			})
			.catch((err) => {
				console.log(err);
				this.setState({inProgress: false});
			})
	}

	arrayBufferToBase64(buffer) {
		var binary = '';
		var bytes = new Uint8Array(buffer);
		var len = bytes.byteLength;
		for (var i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return window.btoa(binary);
	}

	handleRowClick(e) {
		fetch(e.link)
			.then((response) => response.arrayBuffer())
			.then((result) => {
				console.log(result);
				this.nzbGet.append(e.title, this.arrayBufferToBase64(result), 'movie', 0, false, false, '', 0, 'SCORE', (err, res) => {
					if (err)
						console.log(err);
					if (res)
						console.log(res);
				});
			})
			.catch(function(err) {
				console.log(err);
			});
	}

	handleOpenSettings() {
		this.setState({openSettings: true});
	}

	handleCloseSettings() {
		var userSettings = JSON.parse(localStorage.getItem('settings'));
		this.setState({openSettings: false, settings: userSettings});
	}

	handleSaveSettings() {
		console.log(this.state.settings);
		this.setState({openSettings: false});
		localStorage.setItem('settings', JSON.stringify(this.state.settings))
		var nzbGetOptions = {
			host: this.state.settings.nzbget_host,
			port: this.state.settings.nzbget_port,
			login: this.state.settings.nzbget_user,
			hash: this.state.settings.nzbget_password,
			testJsonDir: `${__dirname}/`
		}
		console.log(nzbGetOptions);
		this.nzbGet = new NZBGet(nzbGetOptions);
		this.mdb = MovieDB(this.state.settings.tmdb_api_key);
	}

	handleSettings(e, setting) {
		var set = this.state.settings;
		set[setting] = e.target.value;
		this.setState({settings: set});
	}

	artwork(url) {
		if (url)
			return 'http://image.tmdb.org/t/p/w1920' + url;
		return './public/img/logo.png';
	}

	// Update input box

    // Render method
    render () {

		var details;
		var nzbs;
		if (this.state.movie.imdb_id) {
			details = <Details
				title = {this.state.movie.title}
				date = {this.state.movie.release_date ? new Date(this.state.movie.release_date).toLocaleDateString() : ''}
				description = {this.state.movie.overview}
				artwork = {this.artwork(this.state.movie.backdrop_path)}
				action = {<NzbSearch handleClick = {this.handleClick.bind(this)} />}
			/>;
		}

		var nzbTable;
		if (this.state.nzbItems && this.state.nzbItems.length > 0) {
			nzbTable = <ResultList
				handleRowClick = {this.handleRowClick.bind(this)}
				items = {this.state.nzbItems}
			/>;
		}

		var inProgress;
		if (this.state.inProgress)
			inProgress = <LinearProgress mode="indeterminate" />;

		var float = {
			float: 'right'
		}
        return (
	        <div>
				<Settings
					actions={[
						<FlatButton label="Cancel" primary={true} onTouchTap={this.handleCloseSettings.bind(this)}/>,
						<FlatButton label="Save" primary={false} onTouchTap={this.handleSaveSettings.bind(this)}/>
					]}
					open={this.state.openSettings}
					handleSettings={this.handleSettings.bind(this)}
					settings={this.state.settings}
				/>
				<Search
					label="Search Movies..."
					items={this.state.movies}
					handleSelect={this.handleSelect.bind(this)}
					handleChange={this.handleChange.bind(this)}
					menu={<Menu action={this.handleOpenSettings.bind(this)}/>}
				/>
				<br/>
				{details}
				<div>
					<center>
						{inProgress}
					</center>
				</div>
				{nzbTable}
			</div>
        );
    }
}

// Export AppContainer Component
export default AppContainer
