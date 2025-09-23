import mongoose from 'mongoose';
import { Color } from '../models/color.model.js';

// List of 100 colors with name and hex code
const colors = [
  { name: 'Red', code: '#FF0000' },
  { name: 'Green', code: '#008000' },
  { name: 'Blue', code: '#0000FF' },
  { name: 'Yellow', code: '#FFFF00' },
  { name: 'Purple', code: '#800080' },
  { name: 'Orange', code: '#FFA500' },
  { name: 'Pink', code: '#FFC0CB' },
  { name: 'Cyan', code: '#00FFFF' },
  { name: 'Magenta', code: '#FF00FF' },
  { name: 'Lime', code: '#00FF00' },
  { name: 'Teal', code: '#008080' },
  { name: 'Violet', code: '#EE82EE' },
  { name: 'Indigo', code: '#4B0082' },
  { name: 'Gold', code: '#FFD700' },
  { name: 'Silver', code: '#C0C0C0' },
  { name: 'Gray', code: '#808080' },
  { name: 'Black', code: '#000000' },
  { name: 'White', code: '#FFFFFF' },
  { name: 'Brown', code: '#A52A2A' },
  { name: 'Beige', code: '#F5F5DC' },
  { name: 'Coral', code: '#FF7F50' },
  { name: 'Crimson', code: '#DC143C' },
  { name: 'Turquoise', code: '#40E0D0' },
  { name: 'Olive', code: '#808000' },
  { name: 'Maroon', code: '#800000' },
  { name: 'Navy', code: '#000080' },
  { name: 'Aqua', code: '#00FFFF' },
  { name: 'Fuchsia', code: '#FF00FF' },
  { name: 'Salmon', code: '#FA8072' },
  { name: 'Khaki', code: '#F0E68C' },
  { name: 'Plum', code: '#DDA0DD' },
  { name: 'Orchid', code: '#DA70D6' },
  { name: 'Tan', code: '#D2B48C' },
  { name: 'Ivory', code: '#FFFFF0' },
  { name: 'Mint', code: '#98FF98' },
  { name: 'Lavender', code: '#E6E6FA' },
  { name: 'Peach', code: '#FFDAB9' },
  { name: 'Slate', code: '#708090' },
  { name: 'Tomato', code: '#FF6347' },
  { name: 'Azure', code: '#F0FFFF' },
  { name: 'Bisque', code: '#FFE4C4' },
  { name: 'Chocolate', code: '#D2691E' },
  { name: 'Sienna', code: '#A0522D' },
  { name: 'Peru', code: '#CD853F' },
  { name: 'Goldrod', code: '#DAA520' },
  { name: 'Seagreen', code: '#2E8B57' },
  { name: 'Skyblue', code: '#87CEEB' },
  { name: 'Slateblue', code: '#6A5ACD' },
  { name: 'Steelblue', code: '#4682B4' },
  { name: 'Thistle', code: '#D8BFD8' },
  { name: 'Wheat', code: '#F5DEB3' },
  { name: 'Aquamarine', code: '#7FFFD4' },
  { name: 'Cadetblue', code: '#5F9EA0' },
  { name: 'Chartreuse', code: '#7FFF00' },
  { name: 'Cornflower', code: '#6495ED' },
  { name: 'Darkcyan', code: '#008B8B' },
  { name: 'Darkgoldenrod', code: '#B8860B' },
  { name: 'Darkgreen', code: '#006400' },
  { name: 'Darkkhaki', code: '#BDB76B' },
  { name: 'Darkmagenta', code: '#8B008B' },
  { name: 'Darkolivegreen', code: '#556B2F' },
  { name: 'Darkorange', code: '#FF8C00' },
  { name: 'Darkorchid', code: '#9932CC' },
  { name: 'Darkred', code: '#8B0000' },
  { name: 'Darksalmon', code: '#E9967A' },
  { name: 'Darkseagreen', code: '#8FBC8F' },
  { name: 'Darkslateblue', code: '#483D8B' },
  { name: 'Darkslategrey', code: '#2F4F4F' },
  { name: 'Darkturquoise', code: '#00CED1' },
  { name: 'Darkviolet', code: '#9400D3' },
  { name: 'Deeppink', code: '#FF1493' },
  { name: 'Deepskyblue', code: '#00BFFF' },
  { name: 'Dimgray', code: '#696969' },
  { name: 'Dodgerblue', code: '#1E90FF' },
  { name: 'Firebrick', code: '#B22222' },
  { name: 'Floralwhite', code: '#FFFAF0' },
  { name: 'Forestgreen', code: '#228B22' },
  { name: 'Gainsboro', code: '#DCDCDC' },
  { name: 'Ghostwhite', code: '#F8F8FF' },
  { name: 'Greenyellow', code: '#ADFF2F' },
  { name: 'Honeydew', code: '#F0FFF0' },
  { name: 'Hotpink', code: '#FF69B4' },
  { name: 'Indianred', code: '#CD5C5C' },
  { name: 'Lavenderblush', code: '#FFF0F5' },
  { name: 'Lawngreen', code: '#7CFC00' },
  { name: 'Lemonchiffon', code: '#FFFACD' },
  { name: 'Lightblue', code: '#ADD8E6' },
  { name: 'Lightcoral', code: '#F08080' },
  { name: 'Lightcyan', code: '#E0FFFF' },
  { name: 'Lightgoldenrodyellow', code: '#FAFAD2' },
  { name: 'Lightgreen', code: '#90EE90' },
  { name: 'Lightgrey', code: '#D3D3D3' },
  { name: 'Lightpink', code: '#FFB6C1' },
  { name: 'Lightsalmon', code: '#FFA07A' },
  { name: 'Lightseagreen', code: '#20B2AA' },
  { name: 'Lightskyblue', code: '#87CEFA' },
  { name: 'Lightslategray', code: '#778899' },
  { name: 'Lightsteelblue', code: '#B0C4DE' },
  { name: 'Lightyellow', code: '#FFFFE0' },
  { name: 'Limegreen', code: '#32CD32' },
];

const seedColors = async () => {
  try {
    // Check if colors already exist
    const existingColors = await Color.countDocuments();
    if (existingColors > 0) {
      console.log('Colors already seeded, skipping...');
      return;
    }

    // Insert colors
    await Color.insertMany(colors);
    console.log('Successfully seeded 100 colors into the database');
  } catch (error) {
    console.error('Error seeding colors:', error);
  }
};

export default seedColors;