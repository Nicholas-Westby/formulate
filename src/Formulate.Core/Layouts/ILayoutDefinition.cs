using Formulate.Core.Types;

namespace Formulate.Core.Layouts
{
    /// <summary>
    /// A contract for creating a layout definition.
    /// </summary>
    public interface ILayoutDefinition : IDefinition, IHaveEditor
    {
        /// <summary>
        /// Creates a new instance of a <see cref="ILayout"/>.
        /// </summary>
        /// <param name="entity">The current layout settings.</param>
        /// <returns>A <see cref="ILayout"/>.</returns>
        ILayout CreateLayout(PersistedLayout entity);

        /// <inheritdoc />
        public object GetBackOfficeConfiguration(PersistedLayout entity);

        /// <summary>
        /// Gets the configuration a new layout of this kind starts with in the back office.
        /// </summary>
        /// <returns>
        /// By default, the back office configuration of a layout stored without one.
        /// </returns>
        public object GetDefaultConfiguration() => GetBackOfficeConfiguration(new PersistedLayout { KindId = KindId });
    }
}
