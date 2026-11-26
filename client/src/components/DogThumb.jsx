import { initials } from '../lib/constants.js';

export default function DogThumb({ dog, size = 34 }) {
  return (
    <span className="dog-thumb" style={{ width: size, height: size, backgroundImage: dog.photo_url ? `url(${dog.photo_url})` : undefined }} aria-hidden="true">
      {!dog.photo_url && initials(dog.dog_name)}
    </span>
  );
}
