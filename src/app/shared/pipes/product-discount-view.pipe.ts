import { Pipe, PipeTransform } from '@angular/core';
import { Product } from '../../interfaces/common/product';
import { PricePipe } from './price.pipe';

@Pipe({
  name: 'productDiscount',
  standalone: true
})
export class ProductDiscountViewPipe implements PipeTransform {
  private readonly pricePipe = new PricePipe();

  transform(product: Product, _type: string = 'default'): string {
    if (!product) {
      return 'N/A';
    }

    const discountPercentage = this.pricePipe.transform(product, 'discountPercentage');
    return discountPercentage > 0 ? `${discountPercentage}%` : 'N/A';
  }
}
