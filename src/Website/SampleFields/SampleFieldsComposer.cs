using Formulate.Core.DependencyInjection;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace Website.SampleFields;

/// <summary>
/// Adds the sample Phone field, the custom field that docs/extending.md and formulate.rocks describe: its kind
/// (<see cref="PhoneFieldDefinition"/>), what the browser gets for it (<see cref="PhoneFieldMapDefinition"/>) and
/// its renderer, wwwroot/scripts/phone-field.js, which the seeded template loads. The end-to-end tests check it
/// (tests/e2e/specs/custom-renderer.spec.ts). It runs only in the Development environment and is never packed.
/// </summary>
public sealed class SampleFieldsComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        // The host registers its environment as an instance, so it can be read while composing.
        var environment = builder.Services
            .Select(x => x.ImplementationInstance)
            .OfType<IHostEnvironment>()
            .FirstOrDefault();

        if (environment is null || !environment.IsDevelopment())
        {
            // Formulate finds field definitions by scanning, so outside Development the sample's is taken out.
            builder.FormFieldDefinitions().Exclude<PhoneFieldDefinition>();
            return;
        }

        builder.MapDefinitions().Add<PhoneFieldMapDefinition>();
    }
}
