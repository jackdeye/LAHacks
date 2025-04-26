import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'dart:math';

import 'package:voronoi_diagram/voronoi_diagram.dart'; // For Point

// --- Data Model ---
class City {
  final String name;
  final Point<double> position; // Relative coordinates (0.0 to 1.0)
  final String info;

  City({required this.name, required this.position, required this.info});
}

// --- Main Application ---
void main() {
  runApp(const VoronoiMapApp());
}

class VoronoiMapApp extends StatelessWidget {
  const VoronoiMapApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'US Voronoi Map',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      home: const MapScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}

// --- Map Screen Widget ---
class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  // Sample city data - Replace with your actual data
  // Coordinates are relative (0.0 to 1.0 for x and y)
  final List<City> cities = [
    City(
      name: 'New York',
      position: const Point(0.85, 0.35),
      info: 'The Big Apple',
    ),
    City(
      name: 'Los Angeles',
      position: const Point(0.12, 0.6),
      info: 'City of Angels',
    ),
    City(
      name: 'Chicago',
      position: const Point(0.65, 0.4),
      info: 'The Windy City',
    ),
    City(
      name: 'Houston',
      position: const Point(0.55, 0.75),
      info: 'Space City',
    ),
    City(
      name: 'Phoenix',
      position: const Point(0.25, 0.65),
      info: 'Valley of the Sun',
    ),
    City(
      name: 'Denver',
      position: const Point(0.40, 0.50),
      info: 'Mile High City',
    ),
    City(
      name: 'Seattle',
      position: const Point(0.10, 0.20),
      info: 'Emerald City',
    ),
    City(name: 'Miami', position: const Point(0.82, 0.85), info: 'Magic City'),
  ];

  City? _selectedCity;
  Offset? _tapPosition;

  // Placeholder for Voronoi polygons - In a real app, this would be calculated
  // based on the city positions using a Voronoi algorithm.
  // These are just *example* shapes.
  List<List<Point<double>>> _getPlaceholderVoronoiPolygons() {
    // *** This is where you would integrate a Voronoi library ***
    // For now, return simple bounding boxes around points as placeholders
    return cities.map((city) {
      // Define a small box around each city for demonstration
      double boxSize = 0.1; // Relative size
      return [
        Point(
          max(0.0, city.position.x - boxSize / 2),
          max(0.0, city.position.y - boxSize / 2),
        ),
        Point(
          min(1.0, city.position.x + boxSize / 2),
          max(0.0, city.position.y - boxSize / 2),
        ),
        Point(
          min(1.0, city.position.x + boxSize / 2),
          min(1.0, city.position.y + boxSize / 2),
        ),
        Point(
          max(0.0, city.position.x - boxSize / 2),
          min(1.0, city.position.y + boxSize / 2),
        ),
      ];
    }).toList();
  }

  void _handleTap(Offset localPosition, Size size) {
    City? tappedCity;
    double minDistanceSq = double.infinity;
    const double tapRadiusSq = 20.0 * 20.0; // Click sensitivity radius squared

    for (final city in cities) {
      // Convert relative city position to absolute coordinates
      final cityPos = Offset(
        city.position.x * size.width,
        city.position.y * size.height,
      );
      final distanceSq = (localPosition - cityPos).distanceSquared;

      // Check if tap is within the radius and closer than previous closest
      if (distanceSq < tapRadiusSq && distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq;
        tappedCity = city;
      }
    }

    setState(() {
      _selectedCity = tappedCity;
      _tapPosition =
          localPosition; // Store tap position for potential future use
    });

    if (tappedCity != null) {
      _showCityInfoDialog(tappedCity);
    }
  }

  void _showCityInfoDialog(City city) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(city.name),
          content: Text(city.info),
          actions: <Widget>[
            TextButton(
              child: const Text('Close'),
              onPressed: () {
                Navigator.of(context).pop();
              },
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    // IMPORTANT: Replace 'assets/us_map.svg' with the actual path to your SVG file.
    // Make sure the asset is declared in your pubspec.yaml
    const String svgAssetPath = 'assets/us_map.svg';

    return Scaffold(
      appBar: AppBar(title: const Text('US Map with Voronoi Overlay')),
      body: Center(
        child: AspectRatio(
          aspectRatio: 16 / 9, // Adjust aspect ratio based on your map SVG
          child: LayoutBuilder(
            builder: (context, constraints) {
              final size = constraints.biggest;
              final voronoiPolygons = await getVoronoiDiagram(
                sites: cities.map((city) => city.position.toOffset()).toList(),
                diagramBound: Size(size.width, size.height),
              );

              return GestureDetector(
                onTapDown: (details) => _handleTap(details.localPosition, size),
                child: Stack(
                  children: [
                    // 1. US Map Background
                    SvgPicture.asset(
                      svgAssetPath,
                      fit: BoxFit.contain, // Ensure map fits within bounds
                      placeholderBuilder:
                          (BuildContext context) => Container(
                            padding: const EdgeInsets.all(30.0),
                            child: const Center(
                              child: CircularProgressIndicator(),
                            ),
                          ),
                    ),

                    // 2. Voronoi Polygon Overlay
                    CustomPaint(
                      size: size,
                      painter: VoronoiPainter(
                        cities: cities,
                        polygons:
                            voronoiPolygons, // Pass the placeholder polygons
                        selectedCity: _selectedCity,
                      ),
                    ),

                    // 3. City Markers (Optional - Painter can draw them too)
                    // You could also draw markers directly in the painter
                    // Positioned widgets might be less performant with many cities
                    // ... (Example below if needed)
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

// --- Custom Painter for Voronoi Cells and Cities ---
class VoronoiPainter extends CustomPainter {
  final List<City> cities;
  final List<List<Point<double>>>
  polygons; // List of polygons (each a list of points)
  final City? selectedCity;

  VoronoiPainter({
    required this.cities,
    required this.polygons,
    this.selectedCity,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // --- Paint for Voronoi Cells ---
    final cellPaint =
        Paint()
          ..style =
              PaintingStyle
                  .stroke // Draw outlines
          ..color = Colors.blue.withOpacity(0.6)
          ..strokeWidth = 1.5;

    final fillPaint = Paint()..style = PaintingStyle.fill;

    // --- Paint for Cities ---
    final cityPaint =
        Paint()
          ..color =
              Colors
                  .red // Color for city dots
          ..style = PaintingStyle.fill;

    final selectedCityPaint =
        Paint()
          ..color =
              Colors
                  .yellow // Highlight color
          ..style = PaintingStyle.fill;

    // --- Draw Voronoi Polygons ---
    // Ensure we have the same number of polygons as cities (or handle mismatch)
    if (polygons.length == cities.length) {
      for (int i = 0; i < polygons.length; i++) {
        final polygonPoints = polygons[i];
        final path = Path();

        if (polygonPoints.isNotEmpty) {
          // Convert relative points to absolute coordinates for drawing
          final startPoint = Offset(
            polygonPoints[0].x * size.width,
            polygonPoints[0].y * size.height,
          );
          path.moveTo(startPoint.dx, startPoint.dy);

          for (int j = 1; j < polygonPoints.length; j++) {
            final point = Offset(
              polygonPoints[j].x * size.width,
              polygonPoints[j].y * size.height,
            );
            path.lineTo(point.dx, point.dy);
          }
          path.close(); // Close the polygon path

          // Optional: Fill cells with different colors for visual distinction
          // Use a simple hash or index to get varied colors
          final colorIndex = i % Colors.primaries.length;
          fillPaint.color = Colors.primaries[colorIndex].withOpacity(
            0.2,
          ); // Semi-transparent fill
          canvas.drawPath(path, fillPaint); // Fill first

          // Draw the border
          canvas.drawPath(path, cellPaint); // Then draw border
        }
      }
    } else {
      // Handle error or log warning if polygon count doesn't match city count
      print("Warning: Number of polygons does not match number of cities.");
    }

    // --- Draw Cities ---
    const double cityRadius = 5.0; // Size of the city marker dot
    const double selectedCityRadius = 8.0; // Size of selected city marker

    for (final city in cities) {
      // Convert relative position to absolute coordinates
      final offset = Offset(
        city.position.x * size.width,
        city.position.y * size.height,
      );

      // Highlight the selected city
      final bool isSelected = selectedCity?.name == city.name;
      final radius = isSelected ? selectedCityRadius : cityRadius;
      final paint = isSelected ? selectedCityPaint : cityPaint;

      // Add a border to the selected city for better visibility
      if (isSelected) {
        final borderPaint =
            Paint()
              ..color = Colors.black
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1.5;
        canvas.drawCircle(offset, radius, borderPaint);
      }

      canvas.drawCircle(offset, radius, paint);
    }
  }

  @override
  bool shouldRepaint(covariant VoronoiPainter oldDelegate) {
    // Repaint if cities, polygons, or selected city change
    return oldDelegate.cities != cities ||
        oldDelegate.polygons != polygons ||
        oldDelegate.selectedCity != selectedCity;
  }
}
