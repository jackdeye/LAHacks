function Banner() {
	return (
		<div className="banner" style={{
			backgroundColor: '#4CAF50', // Nice green color for environmental theme
			color: 'white',
			padding: '20px',
			textAlign: 'center',
			fontSize: '2em',
			fontFamily: 'Arial, sans-serif',
			fontWeight: 'bold',
			boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)'
		}}>
			Welcome to WasteWatchers
		</div>
	);
}

export default Banner;
