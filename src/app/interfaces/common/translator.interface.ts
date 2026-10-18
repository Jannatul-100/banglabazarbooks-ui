export interface Translator {
  _id?: string;
  name?: string;
  nameEn?: string;
  slug?: string;
  address?: string;
  addressEn?: string;
  description?: string;
  descriptionEn?: string;
  image?: string;
  designation?: string;
  designationEn?: string;
  birthDate?: Date;
  priority?: number;
  followers?: any[];
  createdAt?: Date;
  updatedAt?: Date;
}
