import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { ProductService } from '../../../services/common/product.service';
import { CartService } from '../../../services/common/cart.service';
import { UserService } from '../../../services/common/user.service';
import { ReloadService } from '../../../services/core/reload.service';
import { UiService } from '../../../services/core/ui.service';
import { Product } from '../../../interfaces/common/product';
import { FilterData } from '../../../interfaces/gallery/filter-data';
import { PricePipe } from '../../pipes/price.pipe';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MaterialModule } from '../../../material/material.module';
import { Cart } from '../../../interfaces/common/cart.interface';

@Component({
  selector: 'app-wishlist-matcher-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, PricePipe, TranslateModule, MaterialModule],
  providers: [PricePipe],
  templateUrl: './wishlist-matcher-dialog.component.html',
  styleUrls: ['./wishlist-matcher-dialog.component.scss']
})
export class WishlistMatcherDialogComponent implements OnInit {
  bookListText = signal<string>('');
  isLoading = signal<boolean>(false);
  hasSearched = signal<boolean>(false);
  
  matchedProducts = signal<Product[]>([]);
  unmatchedNames = signal<string[]>([]);
  
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private userService = inject(UserService);
  private reloadService = inject(ReloadService);
  private uiService = inject(UiService);
  public translateService = inject(TranslateService);

  constructor(
    public dialogRef: MatDialogRef<WishlistMatcherDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {}

  onMatchBooks(): void {
    const text = this.bookListText().trim();
    if (!text) return;
    
    // Split by newline or comma, trim whitespace, and remove empty entries
    const names = text.split(/\r?\n|,/)
                      .map((n: string) => n.trim())
                      .filter((n: string) => n.length > 0);
                      
    if (names.length === 0) return;
    
    this.isLoading.set(true);
    this.hasSearched.set(false);
    
    const filterData: FilterData = {
      filter: {
        $or: names.map((name: string) => ({ name: { $regex: name, $options: 'i' } }))
      },
      select: {
        name: 1, images: 1, author: 1, salePrice: 1, costPrice: 1, discountAmount: 1, discountType: 1, hasVariations: 1, slug: 1, stockVisibility: 1, quantity: 1, category: 1, subCategory: 1, brand: 1
      },
      pagination: { currentPage: 0, pageSize: 100 },
      sort: { createdAt: -1 }
    };

    this.productService.getAllProducts(filterData).subscribe({
      next: (res: any) => {
        this.isLoading.set(false);
        this.hasSearched.set(true);
        if (res.data) {
          // Identify unmatched names
          const foundProducts: Product[] = res.data;
          this.matchedProducts.set(foundProducts);
          
          const foundNames = foundProducts.map((p: Product) => p.name.toLowerCase());
          const notFound = names.filter((name: string) => {
            const lowerName = name.toLowerCase();
            return !foundNames.some((fn: string) => fn.includes(lowerName));
          });
          
          this.unmatchedNames.set(notFound);
        }
      },
      error: (err: any) => {
        console.error('Error fetching matched products', err);
        this.isLoading.set(false);
      }
    });
  }

  addAllToCart(): void {
    const products = this.matchedProducts();
    if (products.length === 0) return;
    
    const carts: Cart[] = products.map((product: Product) => {
      return {
        product: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images && product.images.length ? product.images[0] : '',
        category: product.category as any,
        subCategory: product.subCategory as any,
        brand: product.brand as any,
        regularPrice: product.costPrice,
        unitPrice: product.salePrice,
        selectedQty: 1,
        author: product.author as any,
      };
    });
    
    if (this.userService.getUserStatus()) {
      // Add to DB for logged in user
      this.cartService.addToCartMultiple(carts).subscribe({
        next: (res: any) => {
          this.uiService.success('সকল বই কার্টে যোগ করা হয়েছে।');
          this.reloadService.needRefreshCart$(true);
          this.dialogRef.close(true);
        },
        error: (err: any) => {
          console.error(err);
          this.uiService.wrong('কার্টে যোগ করতে সমস্যা হয়েছে।');
        }
      });
    } else {
      // Add to local storage
      carts.forEach((cart: Cart) => {
        this.cartService.addCartItemToLocalStorage(cart);
      });
      this.uiService.success('সকল বই কার্টে যোগ করা হয়েছে।');
      this.reloadService.needRefreshCart$(true);
      this.dialogRef.close(true);
    }
  }
}
