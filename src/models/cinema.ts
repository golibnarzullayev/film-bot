import { Schema, model } from 'mongoose';

export interface IFilm extends Document {
   code: number,
   url: string;
   name: string;
}

const filmSchema = new Schema<IFilm>({
   code: { type: Number, required: true, unique: true },
   url: { type: String, required: true, unique: true },
   name: { type: String, required: true },
});

const Film = model<IFilm>('Film', filmSchema);

export default Film;